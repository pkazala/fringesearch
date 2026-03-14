import { NextRequest, NextResponse } from "next/server";

import { fetchFringeEvents } from "@/lib/fringe/api";
import { normalizeEvent } from "@/lib/fringe/normalize";
import { scoreAndFilterEvents } from "@/lib/fringe/ranking";
import type { EventSearchFilters, ScoredEventsResponse } from "@/lib/fringe/types";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  payload: ScoredEventsResponse;
};

const routeCache = new Map<string, CacheEntry>();

function parseBoolean(value: string | null) {
  return value === "1" || value === "true";
}

function parseNumber(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDateBoundary(value: string | null, boundary: "start" | "end") {
  if (!value) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T${boundary === "start" ? "00:00:00" : "23:59:59"}`;
  }

  return value;
}

function toFilters(searchParams: URLSearchParams): EventSearchFilters {
  return {
    query: searchParams.get("query") ?? undefined,
    dateFrom: parseDateBoundary(searchParams.get("dateFrom"), "start"),
    dateTo: parseDateBoundary(searchParams.get("dateTo"), "end"),
    genre: searchParams.get("genre") ?? undefined,
    priceTo: parseNumber(searchParams.get("priceTo")),
    lat: parseNumber(searchParams.get("lat")),
    lon: parseNumber(searchParams.get("lon")),
    distance: searchParams.get("distance") ?? undefined,
    hasAudioDescription: parseBoolean(searchParams.get("hasAudioDescription")),
    hasCaptioning: parseBoolean(searchParams.get("hasCaptioning")),
    hasSigned: parseBoolean(searchParams.get("hasSigned")),
    hasOtherAccessibility: parseBoolean(searchParams.get("hasOtherAccessibility")),
    size: parseNumber(searchParams.get("size")),
    from: parseNumber(searchParams.get("from")),
  };
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const byId = new Map<string, T>();

  for (const item of items) {
    byId.set(item.id, item);
  }

  return [...byId.values()];
}

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.toString();
    const now = Date.now();

    const cached = routeCache.get(key);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.payload);
    }

    const filters = toFilters(request.nextUrl.searchParams);
    const rawEvents = await fetchFringeEvents(filters);

    const normalized = dedupeById(rawEvents.map(normalizeEvent));
    const scored = scoreAndFilterEvents(normalized, filters);

    const availableGenres = [...new Set(scored.map((event) => event.genre))]
      .filter((genre) => genre !== "Unknown")
      .sort((a, b) => a.localeCompare(b));

    const payload: ScoredEventsResponse = {
      events: scored,
      topSuggestions: scored.slice(0, 8),
      total: scored.length,
      availableGenres,
    };

    routeCache.set(key, {
      payload,
      expiresAt: now + CACHE_TTL_MS,
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      {
        events: [],
        topSuggestions: [],
        total: 0,
        availableGenres: [],
        error: message,
      },
      { status: 500 },
    );
  }
}
