"use client";

import type { EventSummary } from "@/lib/fringe/types";

type EventDetailCardProps = {
  event: EventSummary;
  onClose: () => void;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventDetailCard({ event, onClose }: EventDetailCardProps) {
  return (
    <aside className="absolute bottom-4 left-4 right-4 z-30 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:left-auto sm:max-w-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">{event.title}</h3>
          <p className="text-xs text-zinc-600">
            {event.genre} · {event.venueName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
        >
          Close
        </button>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-zinc-700 sm:grid-cols-2">
        <p>
          <span className="font-medium text-zinc-900">When:</span>{" "}
          {formatDate(event.firstPerformanceStart)}
        </p>
        <p>
          <span className="font-medium text-zinc-900">Price:</span> {event.priceLabel}
        </p>
        <p>
          <span className="font-medium text-zinc-900">Venue:</span> {event.venueAddress}
        </p>
        <p>
          <span className="font-medium text-zinc-900">Postcode:</span> {event.postCode}
        </p>
      </div>

      <p className="mt-3 line-clamp-4 text-xs text-zinc-600">{event.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {event.accessibility.audio && (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] text-emerald-800">
            Audio description
          </span>
        )}
        {event.accessibility.captioning && (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] text-emerald-800">
            Captioning
          </span>
        )}
        {event.accessibility.signed && (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] text-emerald-800">
            Signed
          </span>
        )}
        {event.accessibility.otherServices && (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] text-emerald-800">
            Other access
          </span>
        )}
      </div>

      {event.website && (
        <a
          href={event.website}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
        >
          Open festival listing
        </a>
      )}
    </aside>
  );
}
