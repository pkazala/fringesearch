import { createHmac } from "node:crypto";

import type { EventSearchFilters, FringeApiEvent } from "@/lib/fringe/types";

const EDINBURGH_API_BASE = "https://api.edinburghfestivalcity.com";
const FESTIVAL_ID = "demofringe";
const FRINGE_API_KEY = process.env.FRINGE_API_KEY?.trim();
const FRINGE_API_SECRET_KEY = process.env.FRINGE_API_SECRET_KEY?.trim();

function buildSignedUrl(path: string, params: URLSearchParams) {
  if (!FRINGE_API_KEY || !FRINGE_API_SECRET_KEY) {
    throw new Error("Missing FRINGE_API_KEY or FRINGE_API_SECRET_KEY in environment");
  }

  const signedParams = new URLSearchParams(params);
  signedParams.set("key", FRINGE_API_KEY);

  const unsignedPath = `${path}?${signedParams.toString()}`;
  const signature = createHmac("sha1", FRINGE_API_SECRET_KEY)
    .update(unsignedPath)
    .digest("hex");

  return `${EDINBURGH_API_BASE}${unsignedPath}&signature=${signature}`;
}

function parseEventListResponse(payload: unknown): FringeApiEvent[] {
  if (Array.isArray(payload)) {
    return payload as FringeApiEvent[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidate = payload as {
    events?: unknown;
    results?: unknown;
    items?: unknown;
    data?: unknown;
  };

  if (Array.isArray(candidate.events)) {
    return candidate.events as FringeApiEvent[];
  }

  if (Array.isArray(candidate.results)) {
    return candidate.results as FringeApiEvent[];
  }

  if (Array.isArray(candidate.items)) {
    return candidate.items as FringeApiEvent[];
  }

  if (Array.isArray(candidate.data)) {
    return candidate.data as FringeApiEvent[];
  }

  return [];
}

function buildEventsQuery(filters: EventSearchFilters) {
  const params = new URLSearchParams();

  params.set("festival", FESTIVAL_ID);
  params.set("year", "2025");
  params.set("size", String(Math.min(filters.size ?? 100, 100)));
  params.set("from", String(Math.max(filters.from ?? 0, 0)));

  if (filters.query) {
    params.set("title", filters.query);
    params.set("description", filters.query);
  }

  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }

  if (Array.isArray(filters.genres)) {
    for (const genre of filters.genres) {
      const nextGenre = genre.trim();
      if (nextGenre) {
        params.append("genre", nextGenre);
      }
    }
  }

  if (typeof filters.priceTo === "number") {
    params.set("price_to", String(filters.priceTo));
  }

  if (typeof filters.lat === "number") {
    params.set("lat", String(filters.lat));
  }

  if (typeof filters.lon === "number") {
    params.set("lon", String(filters.lon));
  }

  if (filters.distance) {
    params.set("distance", filters.distance);
  }

  if (filters.hasAudioDescription) {
    params.set("has_audio_description", "1");
  }

  if (filters.hasCaptioning) {
    params.set("has_captioning", "1");
  }

  if (filters.hasSigned) {
    params.set("has_signed", "1");
  }

  if (filters.hasOtherAccessibility) {
    params.set("has_other_accessibility", "1");
  }

  return params;
}

export async function fetchFringeEvents(filters: EventSearchFilters) {
  const params = buildEventsQuery(filters);
  const url = buildSignedUrl("/events", params);

  const response = await fetch(url, {
    next: { revalidate: 600 },
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 240);
    throw new Error(`Failed to fetch events (${response.status}) ${details}`);
  }

  const json = (await response.json()) as unknown;
  return parseEventListResponse(json);
}

export async function fetchFringeEventById(eventId: string) {
  const safeEventId = eventId.replace(/\//g, "");
  const encodedEventId = encodeURIComponent(safeEventId);
  const params = new URLSearchParams({
    festival: FESTIVAL_ID,
    year: "2025",
  });

  const url = buildSignedUrl(`/events/${encodedEventId}`, params);

  const response = await fetch(url, {
    next: { revalidate: 600 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch event details (${response.status})`);
  }

  return (await response.json()) as FringeApiEvent;
}
