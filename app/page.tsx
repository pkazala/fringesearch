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

const DEFAULT_FILTERS: DiscoveryFilters = {
  query: "",
  dateFrom: "",
  dateTo: "",
  genre: "",
  priceTo: "",
  hasAudioDescription: false,
  hasCaptioning: false,
  hasSigned: false,
  hasOtherAccessibility: false,
};

function readFilterFromQuery(searchParams: URLSearchParams): DiscoveryFilters {
  return {
    query: searchParams.get("query") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    genre: searchParams.get("genre") ?? "",
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
  if (filters.genre) {
    query.set("genre", filters.genre);
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
  params.set("size", "100");
  params.set("from", "0");
  return params.toString();
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
  const [chatCollapsed, setChatCollapsed] = useState(false);
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
        setAvailableGenres(data.availableGenres ?? []);

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
      } finally {
        setLoading(false);
      }
    };

    loadEvents();

    return () => {
      controller.abort();
    };
  }, [activeFilters]);

  const applyFilters = useCallback(() => {
    setActiveFilters(draftFilters);
    const queryString = createQueryString(draftFilters);
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [draftFilters, pathname, router]);

  return (
    <div className="min-h-screen bg-background">
      <SearchBar
        value={draftFilters}
        availableGenres={availableGenres}
        loading={loading}
        onChange={setDraftFilters}
        onApply={applyFilters}
      />

      <main
        className={cn(
          "mx-auto grid w-full max-w-[1500px] gap-4 px-4 py-4 lg:px-6 motion-safe:transition-[grid-template-columns] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none",
          chatCollapsed
            ? "lg:grid-cols-[minmax(320px,320px)_minmax(420px,1fr)_96px]"
            : "lg:grid-cols-[minmax(320px,320px)_minmax(420px,1fr)_360px]",
        )}
      >
        <EventList
          events={events}
          selectedEventId={selectedEvent?.id ?? null}
          loading={loading}
          onSelect={setSelectedEvent}
        />

        <GoogleMapPanel
          events={events}
          topSuggestions={topSuggestions}
          selectedEvent={selectedEvent}
          onSelectEvent={setSelectedEvent}
          onCloseDetails={() => setSelectedEvent(null)}
        />

        <RulesChatSidebar
          events={events}
          filters={activeFilters}
          collapsed={chatCollapsed}
          onCollapsedChange={setChatCollapsed}
        />
      </main>

      {error && (
        <div className="mx-auto mb-4 w-full max-w-[1500px] px-4 lg:px-6">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </p>
        </div>
      )}
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
