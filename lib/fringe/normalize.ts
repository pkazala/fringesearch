import type { EventSummary, FringeApiEvent } from "@/lib/fringe/types";

function asText(value: string | null | undefined, fallback = "Unknown") {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

function getImageUrl(images: FringeApiEvent["images"]) {
  if (!images) {
    return null;
  }

  const first = Object.values(images).find(
    (image) => image?.versions?.original?.url,
  );

  return first?.versions?.original?.url ?? null;
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

  const firstPerformanceStart =
    starts.length > 0
      ? starts.reduce((a, b) => (a < b ? a : b))
      : null;

  const lastPerformanceEnd =
    ends.length > 0 ? ends.reduce((a, b) => (a > b ? a : b)) : null;

  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

  return {
    firstPerformanceStart,
    lastPerformanceEnd,
    minPrice,
    maxPrice,
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
    imageUrl: getImageUrl(event.images),
    artist: asText(event.artist),
    country: asText(event.country),
    updated: asText(event.updated),
    minPrice: performanceStats.minPrice,
    maxPrice: performanceStats.maxPrice,
    priceLabel: performanceStats.priceLabel,
    firstPerformanceStart: performanceStats.firstPerformanceStart,
    lastPerformanceEnd: performanceStats.lastPerformanceEnd,
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
