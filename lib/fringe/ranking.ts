import type { EventSearchFilters, EventSummary } from "@/lib/fringe/types";

type ScoredEvent = EventSummary;

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function includesAnyToken(haystack: string, tokens: string[]) {
  const lower = haystack.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

function toDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function overlapsWindow(
  eventStart: Date | null,
  eventEnd: Date | null,
  from: Date | null,
  to: Date | null,
) {
  if (!from && !to) {
    return true;
  }

  if (!eventStart && !eventEnd) {
    return false;
  }

  const effectiveStart = eventStart ?? eventEnd;
  const effectiveEnd = eventEnd ?? eventStart;

  if (!effectiveStart || !effectiveEnd) {
    return false;
  }

  if (from && effectiveEnd < from) {
    return false;
  }

  if (to && effectiveStart > to) {
    return false;
  }

  return true;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function parseDistanceToKm(distance: string | undefined) {
  if (!distance) {
    return null;
  }

  const normalized = distance.trim().toLowerCase();
  const numeric = Number.parseFloat(normalized.replace(/[^0-9.]/g, ""));

  if (Number.isNaN(numeric)) {
    return null;
  }

  if (normalized.includes("mile")) {
    return numeric * 1.60934;
  }

  if (normalized.includes("kilometer") || normalized.includes("km")) {
    return numeric;
  }

  return null;
}

export function scoreAndFilterEvents(
  events: EventSummary[],
  filters: EventSearchFilters,
): ScoredEvent[] {
  const from = toDate(filters.dateFrom);
  const to = toDate(filters.dateTo);
  const queryTokens = tokenize(filters.query ?? "");
  const maxDistanceKm = parseDistanceToKm(filters.distance);
  const normalizedGenres = (filters.genres ?? [])
    .map((genre) => genre.trim().toLowerCase())
    .filter(Boolean);

  const scored = events
    .filter((event) => {
      if (event.status === "cancelled" || event.status === "deleted") {
        return false;
      }

      if (normalizedGenres.length > 0 && !normalizedGenres.includes(event.genre.toLowerCase())) {
        return false;
      }

      if (
        typeof filters.priceTo === "number" &&
        event.minPrice !== null &&
        event.minPrice > filters.priceTo
      ) {
        return false;
      }

      if (filters.hasAudioDescription && !event.accessibility.audio) {
        return false;
      }

      if (filters.hasCaptioning && !event.accessibility.captioning) {
        return false;
      }

      if (filters.hasSigned && !event.accessibility.signed) {
        return false;
      }

      if (filters.hasOtherAccessibility && !event.accessibility.otherServices) {
        return false;
      }

      const eventStart = toDate(event.firstPerformanceStart);
      const eventEnd = toDate(event.lastPerformanceEnd);

      if (!overlapsWindow(eventStart, eventEnd, from, to)) {
        return false;
      }

      if (
        maxDistanceKm !== null &&
        typeof filters.lat === "number" &&
        typeof filters.lon === "number" &&
        typeof event.lat === "number" &&
        typeof event.lon === "number"
      ) {
        const distanceKm = haversineKm(filters.lat, filters.lon, event.lat, event.lon);
        if (distanceKm > maxDistanceKm) {
          return false;
        }
      }

      return true;
    })
    .map((event) => {
      let score = 10;
      const reasons: string[] = [];

      if (queryTokens.length > 0) {
        const searchable = `${event.title} ${event.description} ${event.artist} ${event.genre}`;
        const matches = queryTokens.filter((token) => searchable.toLowerCase().includes(token));

        if (matches.length > 0) {
          score += Math.min(30, matches.length * 8);
          reasons.push(`Matches ${matches.length} preference keyword${matches.length > 1 ? "s" : ""}`);
        } else {
          score -= 8;
        }
      }

      if (normalizedGenres.length > 0 && normalizedGenres.includes(event.genre.toLowerCase())) {
        score += 20;
        reasons.push("Category matches your preferences");
      }

      if (typeof filters.priceTo === "number") {
        if (event.minPrice === null) {
          score += 2;
        } else if (event.minPrice <= filters.priceTo) {
          score += 14;
          reasons.push("Fits your budget");
        }
      }

      if (filters.dateFrom || filters.dateTo) {
        score += 18;
        reasons.push("Runs during your attendance dates");
      }

      if (filters.hasAudioDescription && event.accessibility.audio) {
        score += 8;
        reasons.push("Audio description available");
      }

      if (filters.hasCaptioning && event.accessibility.captioning) {
        score += 8;
        reasons.push("Captioned performances available");
      }

      if (filters.hasSigned && event.accessibility.signed) {
        score += 8;
        reasons.push("Signed performances available");
      }

      if (filters.hasOtherAccessibility && event.accessibility.otherServices) {
        score += 6;
        reasons.push("Other accessible options available");
      }

      if (
        typeof filters.lat === "number" &&
        typeof filters.lon === "number" &&
        typeof event.lat === "number" &&
        typeof event.lon === "number"
      ) {
        const distanceKm = haversineKm(filters.lat, filters.lon, event.lat, event.lon);
        const locationScore = Math.max(0, 15 - Math.round(distanceKm));
        score += locationScore;

        if (locationScore > 0) {
          reasons.push("Close to your preferred area");
        }
      }

      if (event.imageUrl) {
        score += 2;
      }

      if (reasons.length === 0) {
        reasons.push("Strong overall match for a Fringe 2025 visit");
      }

      return {
        ...event,
        score,
        scoreReasons: reasons,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.title.localeCompare(b.title);
    });

  return scored;
}

export function filterByIntent(events: EventSummary[], intentText: string) {
  const intentTokens = tokenize(intentText);

  if (intentTokens.length === 0) {
    return events.slice(0, 5);
  }

  const filtered = events
    .filter((event) => {
      const searchable = `${event.title} ${event.genre} ${event.description} ${event.venueName}`;
      return includesAnyToken(searchable, intentTokens);
    })
    .slice(0, 5);

  return filtered.length > 0 ? filtered : events.slice(0, 5);
}
