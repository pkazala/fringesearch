"use client";

import { useMemo, useState } from "react";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import type { DiscoveryFilters } from "@/components/fringe/search-bar";
import type { EventSummary } from "@/lib/fringe/types";

type RulesChatSidebarProps = {
  events: EventSummary[];
  filters: DiscoveryFilters;
};

function compactEvents(events: EventSummary[]) {
  return events.slice(0, 40).map((event) => ({
    id: event.id,
    title: event.title,
    genre: event.genre,
    venueName: event.venueName,
    minPrice: event.minPrice,
    firstPerformanceStart: event.firstPerformanceStart,
    score: event.score,
    scoreReasons: event.scoreReasons,
    description: event.description.slice(0, 280),
  }));
}

export function RulesChatSidebar({ events, filters }: RulesChatSidebarProps) {
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    [],
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";

  return (
    <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white">
      <header className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Fringe assistant</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Rules-based suggestions via AI SDK chat transport.
        </p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-600">
            Try: cheap comedy on my dates, or accessible family events near city centre.
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[95%] rounded-2xl px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-auto bg-emerald-600 text-white"
                : "bg-zinc-100 text-zinc-800"
            }`}
          >
            {message.parts.map((part, index) =>
              part.type === "text" ? (
                <p key={`${message.id}-${index}`} className="whitespace-pre-wrap leading-relaxed">
                  {part.text}
                </p>
              ) : null,
            )}
          </div>
        ))}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            Something went wrong in chat. Please try again.
          </div>
        )}
      </div>

      <form
        className="border-t border-zinc-200 p-3"
        onSubmit={async (event) => {
          event.preventDefault();

          const text = input.trim();
          if (!text || isBusy) {
            return;
          }

          setInput("");

          await sendMessage(
            { text },
            {
              body: {
                context: {
                  events: compactEvents(events),
                  preferences: {
                    dateFrom: filters.dateFrom || undefined,
                    dateTo: filters.dateTo || undefined,
                    genre: filters.genre || undefined,
                    priceTo: filters.priceTo ? Number(filters.priceTo) : undefined,
                    accessibility: [
                      filters.hasAudioDescription ? "audio" : null,
                      filters.hasCaptioning ? "captioning" : null,
                      filters.hasSigned ? "signed" : null,
                      filters.hasOtherAccessibility ? "other" : null,
                    ].filter(Boolean),
                  },
                },
              },
            },
          );
        }}
      >
        <label className="sr-only" htmlFor="chat-input">
          Chat input
        </label>
        <textarea
          id="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          placeholder="Tell me what vibe you're after..."
          className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {isBusy ? "Thinking..." : "Ready"}
          </span>
          <div className="flex gap-2">
            {isBusy && (
              <button
                type="button"
                onClick={() => stop()}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
              >
                Stop
              </button>
            )}
            <button
              type="submit"
              className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isBusy || input.trim().length === 0}
            >
              Send
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}
