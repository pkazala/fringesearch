import type { EventSummary, FringeApiEvent } from "@/lib/fringe/types";

const IMAGE_VERSION_PRIORITY = [
  "original",
  "large-1024",
  "medium-640",
  "small-320",
  "thumb-100",
  "square-150",
  "square-75",
] as const;
const IMAGE_VERSION_SCORES: Record<string, number> = {
  original: 700,
  "large-1024": 600,
  "medium-640": 500,
  "small-320": 350,
  "thumb-100": 220,
  "square-150": 180,
  "square-75": 120,
};

function asText(value: string | null | undefined, fallback = "Unknown") {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

function toAbsoluteImageUrl(url: string) {
  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  return url;
}

function getImageUrls(images: FringeApiEvent["images"]) {
  if (!images) {
    return [];
  }

  const scored = Object.values(images)
    .map((image) => {
      const versions = image?.versions;
      if (!versions) {
        return null;
      }

      let chosenKey: string | null = null;
      let chosenUrl: string | null = null;
      for (const key of IMAGE_VERSION_PRIORITY) {
        const candidate = versions[key]?.url;
        if (candidate) {
          chosenKey = key;
          chosenUrl = candidate;
          break;
        }
      }

      if (!chosenUrl) {
        for (const [key, version] of Object.entries(versions)) {
          if (version?.url) {
            chosenKey = key;
            chosenUrl = version.url;
            break;
          }
        }
      }

      if (!chosenUrl) {
        return null;
      }

      const versionScore = IMAGE_VERSION_SCORES[chosenKey ?? ""] ?? 100;
      const typeScore = image?.type === "hero" ? 80 : 20;
      const orientationScore =
        image?.orientation === "landscape"
          ? 25
          : image?.orientation === "square"
            ? 15
            : 10;
      const dimensionsScore = Math.min(
        ((image?.width ?? 0) * (image?.height ?? 0)) / 20_000,
        120,
      );

      return {
        url: toAbsoluteImageUrl(chosenUrl),
        score: versionScore + typeScore + orientationScore + dimensionsScore,
      };
    })
    .filter((entry): entry is { url: string; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const entry of scored) {
    if (!seen.has(entry.url)) {
      seen.add(entry.url);
      deduped.push(entry.url);
    }
  }

  return deduped;
}

function parsePerformanceStats(event: FringeApiEvent) {
  const performances = event.performances ?? [];

  const prices = performances
    .map((performance) => performance.price)
    .filter((price): price is number => typeof price === "number");

  const starts = performances
    .map((performance) => performance.start)
    .filter((start): start is string => Boolean(start));

  const ends = performances
    .map((performance) => performance.end)
    .filter((end): end is string => Boolean(end));
  const durations = performances
    .map((performance) => {
      if (!performance.start || !performance.end) {
        return null;
      }

      const startDate = new Date(performance.start);
      const endDate = new Date(performance.end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return null;
      }

      const minutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
      return minutes > 0 ? minutes : null;
    })
    .filter((duration): duration is number => typeof duration === "number");

  const firstPerformanceStart =
    starts.length > 0
      ? starts.reduce((a, b) => (a < b ? a : b))
      : null;

  const lastPerformanceEnd =
    ends.length > 0 ? ends.reduce((a, b) => (a > b ? a : b)) : null;

  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const durationMinutes =
    durations.length > 0
      ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
      : null;

  return {
    firstPerformanceStart,
    lastPerformanceEnd,
    minPrice,
    maxPrice,
    durationMinutes,
    priceLabel:
      prices.length > 0
        ? `£${Math.min(...prices).toFixed(0)}${
            Math.min(...prices) !== Math.max(...prices)
              ? `-£${Math.max(...prices).toFixed(0)}`
              : ""
          }`
        : "Unknown",
  };
}

export function normalizeEvent(event: FringeApiEvent): EventSummary {
  const performanceStats = parsePerformanceStats(event);
  const imageUrls = getImageUrls(event.images);

  return {
    id: event.url,
    title: asText(event.title),
    description: asText(event.description),
    festival: asText(event.festival),
    genre: asText(event.genre),
    venueName: asText(event.venue?.name),
    venueAddress: asText(event.venue?.address),
    postCode: asText(event.venue?.post_code),
    lat: event.latitude ?? event.venue?.position?.lat ?? null,
    lon: event.longitude ?? event.venue?.position?.lon ?? null,
    website: event.website,
    status: event.status ?? "active",
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    artist: asText(event.artist),
    country: asText(event.country),
    updated: asText(event.updated),
    minPrice: performanceStats.minPrice,
    maxPrice: performanceStats.maxPrice,
    priceLabel: performanceStats.priceLabel,
    firstPerformanceStart: performanceStats.firstPerformanceStart,
    lastPerformanceEnd: performanceStats.lastPerformanceEnd,
    durationMinutes: performanceStats.durationMinutes,
    accessibility: {
      audio: Boolean(event.disabled?.audio),
      captioning: Boolean(event.disabled?.captioning),
      signed: Boolean(event.disabled?.signed),
      otherServices: Boolean(event.disabled?.other_services),
    },
    score: 0,
    scoreReasons: [],
  };
}
