"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EventList } from "@/components/fringe/event-list";
import { GoogleMapPanel } from "@/components/fringe/google-map-panel";
import { RulesChatSidebar } from "@/components/fringe/rules-chat-sidebar";
import {
  SearchBar,
  type DiscoveryFilters,
} from "@/components/fringe/search-bar";
import { cn } from "@/lib/utils";
import type { EventSummary, ScoredEventsResponse } from "@/lib/fringe/types";

const FESTIVAL_DATE_FROM = "2025-08-01";
const FESTIVAL_DATE_TO = "2025-08-31";

const DEFAULT_FILTERS: DiscoveryFilters = {
  query: "",
  dateFrom: FESTIVAL_DATE_FROM,
  dateTo: FESTIVAL_DATE_TO,
  genres: [],
  priceTo: "",
  hasAudioDescription: false,
  hasCaptioning: false,
  hasSigned: false,
  hasOtherAccessibility: false,
};

function normalizeFestivalDate(value: string | null, fallback: string) {
  const nextValue = value?.trim() ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextValue)) {
    return fallback;
  }

  if (nextValue < FESTIVAL_DATE_FROM) {
    return FESTIVAL_DATE_FROM;
  }

  if (nextValue > FESTIVAL_DATE_TO) {
    return FESTIVAL_DATE_TO;
  }

  return nextValue;
}

function readFilterFromQuery(searchParams: URLSearchParams): DiscoveryFilters {
  const dateFrom = normalizeFestivalDate(searchParams.get("dateFrom"), FESTIVAL_DATE_FROM);
  const dateTo = normalizeFestivalDate(searchParams.get("dateTo"), FESTIVAL_DATE_TO);
  const genres = searchParams
    .getAll("genre")
    .map((genre) => genre.trim())
    .filter(Boolean);
  const [safeDateFrom, safeDateTo] =
    dateFrom <= dateTo
      ? [dateFrom, dateTo]
      : [FESTIVAL_DATE_FROM, FESTIVAL_DATE_TO];

  return {
    query: searchParams.get("query") ?? "",
    dateFrom: safeDateFrom,
    dateTo: safeDateTo,
    genres,
    priceTo: searchParams.get("priceTo") ?? "",
    hasAudioDescription:
      searchParams.get("hasAudioDescription") === "1" ||
      searchParams.get("hasAudioDescription") === "true",
    hasCaptioning:
      searchParams.get("hasCaptioning") === "1" ||
      searchParams.get("hasCaptioning") === "true",
    hasSigned:
      searchParams.get("hasSigned") === "1" ||
      searchParams.get("hasSigned") === "true",
    hasOtherAccessibility:
      searchParams.get("hasOtherAccessibility") === "1" ||
      searchParams.get("hasOtherAccessibility") === "true",
  };
}

function createQueryString(filters: DiscoveryFilters) {
  const query = new URLSearchParams();

  if (filters.query) {
    query.set("query", filters.query);
  }
  if (filters.dateFrom) {
    query.set("dateFrom", filters.dateFrom);
  }
  if (filters.dateTo) {
    query.set("dateTo", filters.dateTo);
  }
  for (const genre of filters.genres) {
    const nextGenre = genre.trim();
    if (nextGenre) {
      query.append("genre", nextGenre);
    }
  }
  if (filters.priceTo) {
    query.set("priceTo", filters.priceTo);
  }
  if (filters.hasAudioDescription) {
    query.set("hasAudioDescription", "1");
  }
  if (filters.hasCaptioning) {
    query.set("hasCaptioning", "1");
  }
  if (filters.hasSigned) {
    query.set("hasSigned", "1");
  }
  if (filters.hasOtherAccessibility) {
    query.set("hasOtherAccessibility", "1");
  }

  return query.toString();
}

function createApiQuery(filters: DiscoveryFilters) {
  const params = new URLSearchParams(createQueryString(filters));
  params.set("from", "0");

  const hasActiveFilters =
    filters.query.trim().length > 0 ||
    filters.genres.length > 0 ||
    filters.priceTo.trim().length > 0 ||
    filters.hasAudioDescription ||
    filters.hasCaptioning ||
    filters.hasSigned ||
    filters.hasOtherAccessibility ||
    filters.dateFrom !== FESTIVAL_DATE_FROM ||
    filters.dateTo !== FESTIVAL_DATE_TO;

  if (hasActiveFilters) {
    params.set("size", "100");
  }

  return params.toString();
}

function mergeGenres(currentGenres: string[], nextGenres: string[], selectedGenres: string[]) {
  return Array.from(new Set([...currentGenres, ...nextGenres, ...selectedGenres]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function HomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialFilters = useMemo(
    () => readFilterFromQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [draftFilters, setDraftFilters] =
    useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [activeFilters, setActiveFilters] =
    useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [topSuggestions, setTopSuggestions] = useState<EventSummary[]>([]);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [mapVisibleEventIds, setMapVisibleEventIds] = useState<string[] | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftFilters(initialFilters);
    setActiveFilters(initialFilters);
  }, [initialFilters]);

  useEffect(() => {
    const controller = new AbortController();

    const loadEvents = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/events?${createApiQuery(activeFilters)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as ScoredEventsResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Could not load events");
        }

        setEvents(data.events ?? []);
        setTopSuggestions(data.topSuggestions ?? []);
        setAvailableGenres((current) =>
          mergeGenres(current, data.availableGenres ?? [], activeFilters.genres),
        );

        if (data.events?.length) {
          setSelectedEvent((current) => {
            if (!current) {
              return data.events[0];
            }
            return data.events.find((event) => event.id === current.id) ?? data.events[0];
          });
        } else {
          setSelectedEvent(null);
        }
      } catch (requestError) {
        if ((requestError as Error).name === "AbortError") {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unexpected error while loading events",
        );
        setEvents([]);
        setTopSuggestions([]);
        setAvailableGenres([]);
        setSelectedEvent(null);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();

    return () => {
      controller.abort();
    };
  }, [activeFilters]);

  useEffect(() => {
    let touchStartY = 0;

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY > 4) {
        setSearchCollapsed(true);
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY ?? touchStartY;
      if (touchStartY - currentY > 6) {
        setSearchCollapsed(true);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  useEffect(() => {
    setMapVisibleEventIds(null);
  }, [events]);

  const visibleSidebarEvents = useMemo(() => {
    if (!mapVisibleEventIds) {
      return events;
    }

    const visibleIds = new Set(mapVisibleEventIds);
    return events.filter((event) => visibleIds.has(event.id));
  }, [events, mapVisibleEventIds]);

  const handleVisibleEventsChange = useCallback((visibleEvents: EventSummary[]) => {
    setMapVisibleEventIds(visibleEvents.map((event) => event.id));
  }, []);

  const applyFilters = useCallback(() => {
    setActiveFilters(draftFilters);
    setSearchCollapsed(true);
    const queryString = createQueryString(draftFilters);
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [draftFilters, pathname, router]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SearchBar
        value={draftFilters}
        availableGenres={availableGenres}
        loading={loading}
        collapsed={searchCollapsed}
        onExpand={() => {
          setSearchCollapsed(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onChange={setDraftFilters}
        onApply={applyFilters}
      />

      <main
        className={cn(
          "mx-auto grid w-full max-w-[1500px] gap-4 px-4 py-4 lg:h-[82vh] lg:min-h-[82vh] lg:px-6 motion-safe:transition-[grid-template-columns] motion-safe:duration-180 motion-safe:ease-out motion-reduce:transition-none",
          chatCollapsed
            ? "lg:grid-cols-[minmax(320px,320px)_minmax(420px,1fr)_96px]"
            : "lg:grid-cols-[minmax(320px,320px)_minmax(420px,1fr)_360px]",
        )}
      >
        <EventList
          events={visibleSidebarEvents}
          selectedEventId={selectedEvent?.id ?? null}
          loading={loading}
          onSelect={setSelectedEvent}
        />

        <GoogleMapPanel
          events={events}
          topSuggestions={topSuggestions}
          selectedEvent={selectedEvent}
          onSelectEvent={setSelectedEvent}
          onVisibleEventsChange={handleVisibleEventsChange}
          onCloseDetails={() => setSelectedEvent(null)}
        />

        <RulesChatSidebar
          events={events}
          filters={activeFilters}
          collapsed={chatCollapsed}
          onCollapsedChange={setChatCollapsed}
          onSelectEvent={setSelectedEvent}
        />
      </main>

    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-600">
          Loading Fringe planner...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
