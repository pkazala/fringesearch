"use client";

import { useEffect, useRef } from "react";

import { getGenreEmoji } from "@/lib/fringe/genre-emoji";
import type { EventSummary } from "@/lib/fringe/types";

type EventListProps = {
  events: EventSummary[];
  selectedEventId: string | null;
  loading: boolean;
  onSelect: (event: EventSummary) => void;
};

function formatEventDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatEventTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRuntime(durationMinutes: number | null) {
  if (typeof durationMinutes !== "number" || durationMinutes <= 0) {
    return "Unknown";
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function EventList({
  events,
  selectedEventId,
  loading,
  onSelect,
}: EventListProps) {
  const eventRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    eventRefs.current[selectedEventId]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedEventId]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Suggested events</h2>
        <span className="text-xs text-zinc-500">{events.length} matches</span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {loading && (
          <p className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            Loading Fringe 2025 events...
          </p>
        )}

        {!loading && events.length === 0 && (
          <p className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            No results found. Try widening dates or removing one filter.
          </p>
        )}

        {events.map((event) => {
          const selected = selectedEventId === event.id;
          const genreEmoji = getGenreEmoji(event.genre);

          return (
            <button
              type="button"
              key={event.id}
              ref={(node) => {
                eventRefs.current[event.id] = node;
              }}
              onClick={() => onSelect(event)}
              className={`w-full rounded-2xl border p-3 text-left transition ${
                selected
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    <span className="mr-1.5" aria-hidden="true">
                      {genreEmoji}
                    </span>
                    {event.title}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {event.genre} · {event.venueName}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white">
                  {event.score}
                </span>
              </div>

              <p className="mt-2 line-clamp-2 text-xs text-zinc-600">{event.description}</p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {event.scoreReasons.slice(0, 2).map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-700"
                  >
                    {reason}
                  </span>
                ))}
              </div>

              <div className="mt-2 text-[11px] text-zinc-500">
                From {event.priceLabel}
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-zinc-500">
                <span className="truncate">Date: {formatEventDate(event.firstPerformanceStart)}</span>
                <span className="truncate">Start: {formatEventTime(event.firstPerformanceStart)}</span>
                <span className="truncate">Run: {formatRuntime(event.durationMinutes)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
