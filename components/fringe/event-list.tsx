"use client";

import type { EventSummary } from "@/lib/fringe/types";

type EventListProps = {
  events: EventSummary[];
  selectedEventId: string | null;
  loading: boolean;
  onSelect: (event: EventSummary) => void;
};

export function EventList({
  events,
  selectedEventId,
  loading,
  onSelect,
}: EventListProps) {
  return (
    <section className="flex min-h-[300px] flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white">
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
            No events found. Try widening dates or removing one filter.
          </p>
        )}

        {events.map((event) => {
          const selected = selectedEventId === event.id;

          return (
            <button
              type="button"
              key={event.id}
              onClick={() => onSelect(event)}
              className={`w-full rounded-2xl border p-3 text-left transition ${
                selected
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{event.title}</p>
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
                From {event.priceLabel} {event.firstPerformanceStart ? "· has schedule" : ""}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
