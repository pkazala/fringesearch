"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { EventDetailCard } from "@/components/fringe/event-detail-card";
import type { EventSummary } from "@/lib/fringe/types";

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (element: Element, options: Record<string, unknown>) => unknown;
        Marker: new (options: Record<string, unknown>) => {
          setMap: (map: unknown) => void;
          addListener: (eventName: string, callback: () => void) => void;
        };
      };
    };
  }
}

const EDINBURGH_CENTER = {
  lat: 55.9533,
  lng: -3.1883,
};

type GoogleMapPanelProps = {
  events: EventSummary[];
  topSuggestions: EventSummary[];
  selectedEvent: EventSummary | null;
  onSelectEvent: (event: EventSummary) => void;
  onCloseDetails: () => void;
};

let googleMapsScriptLoadingPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (googleMapsScriptLoadingPromise) {
    return googleMapsScriptLoadingPromise;
  }

  googleMapsScriptLoadingPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return googleMapsScriptLoadingPromise;
}

export function GoogleMapPanel({
  events,
  topSuggestions,
  selectedEvent,
  onSelectEvent,
  onCloseDetails,
}: GoogleMapPanelProps) {
  const clientEnvApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || null;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<Array<{ setMap: (map: unknown) => void }>>([]);

  const [apiKey, setApiKey] = useState<string | null>(clientEnvApiKey);
  const [configLoaded, setConfigLoaded] = useState(Boolean(clientEnvApiKey));
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  const markerEvents = useMemo(() => {
    return (topSuggestions.length > 0 ? topSuggestions : events)
      .filter((event) => typeof event.lat === "number" && typeof event.lon === "number")
      .slice(0, 60);
  }, [events, topSuggestions]);

  useEffect(() => {
    if (clientEnvApiKey) {
      return;
    }

    let cancelled = false;

    const loadPublicConfig = async () => {
      try {
        const response = await fetch("/api/public-config");
        const data = (await response.json()) as { googleMapsApiKey?: string | null };
        if (!cancelled) {
          setApiKey(data.googleMapsApiKey?.trim() || null);
        }
      } catch {
        if (!cancelled) {
          setApiKey(null);
        }
      } finally {
        if (!cancelled) {
          setConfigLoaded(true);
        }
      }
    };

    loadPublicConfig();

    return () => {
      cancelled = true;
    };
  }, [clientEnvApiKey]);

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    let cancelled = false;
    setMapLoadFailed(false);

    const initializeMap = async () => {
      try {
        await loadGoogleMapsScript(apiKey);
        if (cancelled || !mapContainerRef.current || !window.google?.maps) {
          return;
        }

        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
            center: EDINBURGH_CENTER,
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
        }
      } catch {
        if (!cancelled) {
          setMapLoadFailed(true);
        }
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) {
      return;
    }

    for (const marker of markersRef.current) {
      marker.setMap(null);
    }
    markersRef.current = [];

    for (const event of markerEvents) {
      if (typeof event.lat !== "number" || typeof event.lon !== "number") {
        continue;
      }

      const marker = new window.google.maps.Marker({
        position: { lat: event.lat, lng: event.lon },
        map: mapRef.current,
        title: event.title,
      });

      marker.addListener("click", () => onSelectEvent(event));

      markersRef.current.push(marker);
    }
  }, [markerEvents, onSelectEvent]);

  const mapError = !configLoaded
    ? null
    : !apiKey
      ? "Add GOOGLE_MAPS_API_KEY to .env to enable map view."
    : mapLoadFailed
      ? "Unable to load Google Maps right now."
      : null;

  return (
    <section className="relative min-h-[420px] overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-100">
      {mapError ? (
        <div className="flex h-full min-h-[420px] items-center justify-center p-4 text-center text-sm text-zinc-600">
          {mapError}
        </div>
      ) : !configLoaded ? (
        <div className="flex h-full min-h-[420px] items-center justify-center p-4 text-center text-sm text-zinc-600">
          Loading map...
        </div>
      ) : (
        <div ref={mapContainerRef} className="h-full min-h-[420px] w-full" />
      )}

      {selectedEvent && (
        <EventDetailCard event={selectedEvent} onClose={onCloseDetails} />
      )}
    </section>
  );
}
