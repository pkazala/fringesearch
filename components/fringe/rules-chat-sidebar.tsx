"use client";

import { type FormEvent, useMemo, useState } from "react";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  MessageSquareIcon,
} from "lucide-react";

import type { DiscoveryFilters } from "@/components/fringe/search-bar";
import type { EventSummary } from "@/lib/fringe/types";

const FESTIVAL_DATE_FROM = "2025-08-01";
const FESTIVAL_DATE_TO = "2025-08-31";

type ChatRecommendation = {
  id: string;
  title: string;
  genre: string;
  venueName: string;
  minPrice: number | null;
  firstPerformanceStart: string | null;
};

type AgendaIntensity = "light" | "intense" | "very-intense";

type AgendaDayPlan = {
  date: string;
  events: EventSummary[];
};

type AgendaPlan = {
  budget: number;
  dateFrom: string;
  dateTo: string;
  genres: string[];
  intensity: AgendaIntensity;
  days: AgendaDayPlan[];
};

type RulesChatSidebarProps = {
  events: EventSummary[];
  filters: DiscoveryFilters;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onSelectEvent: (event: EventSummary) => void;
};

function compactEvents(events: EventSummary[]) {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    genre: event.genre,
    venueName: event.venueName,
    minPrice: event.minPrice,
    firstPerformanceStart: event.firstPerformanceStart,
    score: event.score,
    scoreReasons: event.scoreReasons,
    description: event.description.slice(0, 280),
    accessibility: {
      audio: event.accessibility.audio,
      captioning: event.accessibility.captioning,
      signed: event.accessibility.signed,
      other: event.accessibility.otherServices,
    },
  }));
}

function formatPrice(price: number | null) {
  return typeof price === "number" ? `£${price.toFixed(0)}` : "Price unknown";
}

function getDirectionsUrl(event: EventSummary | undefined) {
  if (!event) {
    return null;
  }

  if (typeof event.lat === "number" && typeof event.lon === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lon}`;
  }

  const destination = [event.venueName, event.venueAddress, event.postCode]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");

  if (!destination) {
    return null;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function toIsoDateString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function buildDateRange(dateFrom: string, dateTo: string) {
  const fromDate = new Date(`${dateFrom}T00:00:00Z`);
  const toDate = new Date(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
    return [];
  }

  const days: string[] = [];
  const cursor = new Date(fromDate);

  while (cursor <= toDate) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function formatAgendaDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function escapeHtml(raw: string) {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createAgendaPlan(
  events: EventSummary[],
  options: {
    budget: number;
    dateFrom: string;
    dateTo: string;
    genres: string[];
    intensity: AgendaIntensity;
  },
) {
  const dates = buildDateRange(options.dateFrom, options.dateTo);
  if (dates.length === 0) {
    return null;
  }

  const eventsPerDay =
    options.intensity === "light" ? 2 : options.intensity === "very-intense" ? 5 : 4;
  const chosenGenres = new Set(options.genres.map((genre) => genre.toLowerCase()));

  const candidates = events
    .filter((event) => {
      const withinBudget = event.minPrice === null || event.minPrice <= options.budget;
      const withinGenre =
        chosenGenres.size === 0 || chosenGenres.has(event.genre.toLowerCase());
      const firstStartDate = toIsoDateString(event.firstPerformanceStart);
      const withinDateRange =
        firstStartDate === null ||
        (firstStartDate >= options.dateFrom && firstStartDate <= options.dateTo);

      return withinBudget && withinGenre && withinDateRange;
    })
    .sort((first, second) => second.score - first.score);

  if (candidates.length === 0) {
    return null;
  }

  let cursor = 0;
  const days: AgendaDayPlan[] = dates.map((date) => {
    const dayEvents: EventSummary[] = [];
    const maxAttempts = candidates.length * 2;
    let attempts = 0;

    while (dayEvents.length < eventsPerDay && attempts < maxAttempts) {
      const candidate = candidates[cursor % candidates.length];
      cursor += 1;
      attempts += 1;

      if (dayEvents.some((event) => event.id === candidate.id)) {
        continue;
      }
      dayEvents.push(candidate);
    }

    return { date, events: dayEvents };
  });

  return {
    budget: options.budget,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    genres: options.genres,
    intensity: options.intensity,
    days,
  } satisfies AgendaPlan;
}

function saveAgendaToPdf(plan: AgendaPlan) {
  const nextWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=720");
  if (!nextWindow) {
    return;
  }

  const dayMarkup = plan.days
    .map((day) => {
      const eventsMarkup =
        day.events.length > 0
          ? day.events
            .map(
              (event) => `
                  <article class="event-card">
                    <h3>${escapeHtml(event.title)}</h3>
                    <p>${escapeHtml(event.genre)} · ${escapeHtml(event.venueName)} · ${escapeHtml(formatPrice(event.minPrice))}</p>
                  </article>
                `,
            )
            .join("")
          : `<p class="empty">No matching events for this day.</p>`;

      return `
        <section class="day">
          <h2>${escapeHtml(formatAgendaDate(day.date))}</h2>
          <div class="events">${eventsMarkup}</div>
        </section>
      `;
    })
    .join("");

  nextWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Fringesearch Agenda</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          .meta { margin: 0 0 18px; color: #4b5563; font-size: 12px; }
          .day { margin: 0 0 16px; }
          .day h2 { margin: 0 0 8px; font-size: 15px; }
          .events { display: grid; gap: 8px; }
          .event-card { border: 1px solid #d4d4d8; border-radius: 10px; padding: 10px; }
          .event-card h3 { margin: 0 0 4px; font-size: 13px; }
          .event-card p { margin: 0; color: #4b5563; font-size: 11px; }
          .empty { margin: 0; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>Fringesearch Agenda</h1>
        <p class="meta">Budget up to £${escapeHtml(plan.budget.toFixed(0))} · ${escapeHtml(plan.dateFrom)} to ${escapeHtml(plan.dateTo)} · ${escapeHtml(plan.genres.join(", "))}</p>
        ${dayMarkup}
      </body>
    </html>
  `);
  nextWindow.document.close();
  nextWindow.focus();
  nextWindow.print();
}

function readMessageBody(messageParts: { type: string; text?: string }[]) {
  return messageParts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
}

function parseRecommendations(rawText: string) {
  const blockMatch = rawText.match(/```recs\s*([\s\S]*?)```/i);
  const recommendations: ChatRecommendation[] = [];
  let cleanedText = rawText;

  if (blockMatch?.[1]) {
    try {
      const parsed = JSON.parse(blockMatch[1]) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (
            item &&
            typeof item === "object" &&
            typeof (item as { id?: unknown }).id === "string" &&
            typeof (item as { title?: unknown }).title === "string" &&
            typeof (item as { genre?: unknown }).genre === "string" &&
            typeof (item as { venueName?: unknown }).venueName === "string"
          ) {
            recommendations.push({
              id: (item as { id: string }).id,
              title: (item as { title: string }).title,
              genre: (item as { genre: string }).genre,
              venueName: (item as { venueName: string }).venueName,
              minPrice:
                typeof (item as { minPrice?: unknown }).minPrice === "number"
                  ? (item as { minPrice: number }).minPrice
                  : null,
              firstPerformanceStart:
                typeof (item as { firstPerformanceStart?: unknown }).firstPerformanceStart ===
                  "string"
                  ? (item as { firstPerformanceStart: string }).firstPerformanceStart
                  : null,
            });
          }
        }
      }
    } catch {
      recommendations.length = 0;
    }

    cleanedText = rawText.replace(blockMatch[0], "").trim();
  } else if (rawText.includes("```recs")) {
    cleanedText = rawText.slice(0, rawText.indexOf("```recs")).trim();
  }

  return { cleanedText, recommendations };
}

type EventRecommendationCardProps = {
  title: string;
  genre: string;
  venueName: string;
  minPrice: number | null;
  directionsUrl?: string | null;
  onClick: () => void;
};

function EventRecommendationCard({
  title,
  genre,
  venueName,
  minPrice,
  directionsUrl,
  onClick,
}: EventRecommendationCardProps) {
  return (
    <div className="w-full rounded-lg border border-border/70 bg-background/80 px-3 py-2">
      <button type="button" className="w-full text-left transition hover:bg-accent/40" onClick={onClick}>
        <p className="truncate text-xs font-medium">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {genre} · {venueName} · {formatPrice(minPrice)}
        </p>
      </button>
      {directionsUrl && (
        <div className="mt-1.5">
          <Button
            type="button"
            nativeButton={false}
            size="sm"
            variant="outline"
            render={
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Directions
          </Button>
        </div>
      )}
    </div>
  );
}

export function RulesChatSidebar({
  events,
  filters,
  collapsed,
  onCollapsedChange,
  onSelectEvent,
}: RulesChatSidebarProps) {
  const [input, setInput] = useState("");
  const [agendaMode, setAgendaMode] = useState(false);
  const [agendaBudget, setAgendaBudget] = useState(filters.priceTo);
  const [agendaDateFrom, setAgendaDateFrom] = useState(
    toIsoDateString(filters.dateFrom) ?? FESTIVAL_DATE_FROM,
  );
  const [agendaDateTo, setAgendaDateTo] = useState(
    toIsoDateString(filters.dateTo) ?? FESTIVAL_DATE_TO,
  );
  const [agendaGenres, setAgendaGenres] = useState<string[]>(filters.genres);
  const [agendaIntensity, setAgendaIntensity] = useState<AgendaIntensity>("intense");
  const [agendaPlan, setAgendaPlan] = useState<AgendaPlan | null>(null);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [agendaDialogOpen, setAgendaDialogOpen] = useState(false);

  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const availableGenres = useMemo(
    () =>
      Array.from(new Set(events.map((event) => event.genre).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [events],
  );
  const hasCustomDateSelection =
    filters.dateFrom !== FESTIVAL_DATE_FROM || filters.dateTo !== FESTIVAL_DATE_TO;
  const needsDates = !filters.dateFrom || !filters.dateTo || !hasCustomDateSelection;
  const needsInterests = filters.genres.length === 0 && availableGenres.length > 0;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
  });

  const primeAgendaFromFilters = () => {
    setAgendaBudget(filters.priceTo);
    setAgendaDateFrom(toIsoDateString(filters.dateFrom) ?? FESTIVAL_DATE_FROM);
    setAgendaDateTo(toIsoDateString(filters.dateTo) ?? FESTIVAL_DATE_TO);
    setAgendaGenres(filters.genres);
  };

  const submitAgenda = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAgendaError(null);

    const parsedBudget = Number(agendaBudget);
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      setAgendaError("Add a budget above £0 to build your agenda.");
      return;
    }

    const dateFrom = needsDates
      ? toIsoDateString(agendaDateFrom)
      : toIsoDateString(filters.dateFrom);
    const dateTo = needsDates ? toIsoDateString(agendaDateTo) : toIsoDateString(filters.dateTo);
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      setAgendaError("Pick a valid date range inside the festival window.");
      return;
    }

    const genres = needsInterests ? agendaGenres : filters.genres;
    if (needsInterests && genres.length === 0) {
      setAgendaError("Choose at least one interest to plan the agenda.");
      return;
    }

    const plan = createAgendaPlan(events, {
      budget: parsedBudget,
      dateFrom,
      dateTo,
      genres,
      intensity: agendaIntensity,
    });

    if (!plan || plan.days.every((day) => day.events.length === 0)) {
      setAgendaError("No matching events for this setup. Try a bigger budget or broader interests.");
      setAgendaPlan(null);
      return;
    }

    setAgendaPlan(plan);
  };

  return (
    <Card
      className={cn(
        "flex flex-col",
        collapsed ? "self-start gap-0 overflow-hidden rounded-full py-1" : "h-full min-h-0",
      )}
    >
      <CardHeader className={cn(collapsed ? "px-2 py-1.5" : "border-b")}>
        <div className="flex items-center justify-between gap-2">
          {collapsed ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Open chat"
              onClick={() => onCollapsedChange(false)}
            >
              <MessageSquareIcon className="size-4 text-muted-foreground" />
            </Button>
          ) : (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <Collapsible open={!collapsed} onOpenChange={(open) => onCollapsedChange(!open)}>
                <CollapsibleTrigger
                  render={
                    <Button type="button" variant="outline" size="icon-sm">
                      {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    </Button>
                  }
                />
              </Collapsible>
              <div className="min-w-0 flex items-center gap-1">
                <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                <CardTitle className="text-sm">Fringe Agent</CardTitle>

              </div>
              <Button
                type="button"
                size="sm"
                variant={agendaMode ? "default" : "outline"}
                onClick={() => {
                  setAgendaMode((current) => {
                    const next = !current;
                    if (next) {
                      primeAgendaFromFilters();
                    }
                    return next;
                  });
                  setAgendaError(null);
                }}
              >
                <CalendarDaysIcon data-icon="inline-start" />
                {agendaMode ? "Agenda mode on" : "Plan agenda"}
              </Button>
            </div>
          )}
          {collapsed && (
            <Collapsible open={!collapsed} onOpenChange={(open) => onCollapsedChange(!open)}>
              <CollapsibleTrigger
                render={
                  <Button type="button" variant="outline" size="icon-sm">
                    {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                  </Button>
                }
              />
            </Collapsible>
          )}
        </div>
      </CardHeader>

      {collapsed ? null : (
        <Collapsible open={!collapsed} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CollapsibleContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {agendaMode && (
              <div className="shrink-0 overflow-y-auto border-b px-3 py-3 max-h-[42vh]">
                <p className="text-xs text-muted-foreground">
                  Agenda mode is enabled. I need budget, timing, interests, and intensity before I
                  build your day-by-day plan.
                </p>
                <form className="mt-3 flex flex-col gap-3" onSubmit={submitAgenda}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      suppressHydrationWarning
                      type="number"
                      min={1}
                      value={agendaBudget}
                      onChange={(nextEvent) => setAgendaBudget(nextEvent.target.value)}
                      placeholder="Budget (£)"
                      className="focus-visible:ring-0"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={agendaIntensity === "light" ? "default" : "outline"}
                        onClick={() => setAgendaIntensity("light")}
                      >
                        1-2/day
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={agendaIntensity === "intense" ? "default" : "outline"}
                        onClick={() => setAgendaIntensity("intense")}
                      >
                        3-4/day
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={agendaIntensity === "very-intense" ? "default" : "outline"}
                        onClick={() => setAgendaIntensity("very-intense")}
                      >
                        5/day
                      </Button>
                    </div>
                  </div>

                  {needsDates ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        suppressHydrationWarning
                        type="date"
                        min={FESTIVAL_DATE_FROM}
                        max={FESTIVAL_DATE_TO}
                        value={agendaDateFrom}
                        onChange={(nextEvent) => setAgendaDateFrom(nextEvent.target.value)}
                        className="focus-visible:ring-0"
                      />
                      <Input
                        suppressHydrationWarning
                        type="date"
                        min={FESTIVAL_DATE_FROM}
                        max={FESTIVAL_DATE_TO}
                        value={agendaDateTo}
                        onChange={(nextEvent) => setAgendaDateTo(nextEvent.target.value)}
                        className="focus-visible:ring-0"
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Using selected dates: {filters.dateFrom} to {filters.dateTo}.
                    </p>
                  )}

                  {needsInterests ? (
                    <div className="flex flex-wrap gap-2">
                      {availableGenres.map((genre) => {
                        const selected = agendaGenres.includes(genre);
                        return (
                          <Button
                            key={genre}
                            type="button"
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            onClick={() =>
                              setAgendaGenres((current) =>
                                selected
                                  ? current.filter((entry) => entry !== genre)
                                  : [...current, genre],
                              )
                            }
                          >
                            {genre}
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Using selected interests: {filters.genres.join(", ")}.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" size="sm">
                      Build agenda
                    </Button>
                    {agendaPlan && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setAgendaDialogOpen(true)}
                        >
                          Open agenda
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => saveAgendaToPdf(agendaPlan)}
                        >
                          <FileTextIcon data-icon="inline-start" />
                          Save as PDF
                        </Button>
                      </>
                    )}
                  </div>

                  {agendaError && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                      {agendaError}
                    </p>
                  )}

                  {agendaPlan && (
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-2">
                      <p className="px-1 text-xs text-muted-foreground">
                        Planned agenda ({agendaPlan.dateFrom} to {agendaPlan.dateTo})
                      </p>
                      <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                        {agendaPlan.days.map((day) => (
                          <div key={day.date}>
                            <p className="px-1 text-[11px] font-medium text-muted-foreground">
                              {formatAgendaDate(day.date)}
                            </p>
                            {day.events.length > 0 ? (
                              <div className="mt-1 flex flex-col gap-2">
                                {day.events.map((event) => (
                                  <EventRecommendationCard
                                    key={`agenda-inline-${day.date}-${event.id}`}
                                    title={event.title}
                                    genre={event.genre}
                                    venueName={event.venueName}
                                    minPrice={event.minPrice}
                                    directionsUrl={getDirectionsUrl(event)}
                                    onClick={() => onSelectEvent(event)}
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="px-1 text-[11px] text-muted-foreground">
                                No matching events for this day.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              </div>
            )}

            <Conversation className="min-h-0 flex-1 overflow-y-auto">
              <ConversationContent className="gap-4 p-3">
                {messages.length === 0 ? (
                  <ConversationEmptyState
                    title="Start chatting"
                    description="Try: cheap comedy on my dates, or accessible family events near city centre."
                  />
                ) : (
                  messages.map((message) => {
                    const rawText = readMessageBody(
                      message.parts as Array<{ type: string; text?: string }>,
                    );
                    const parsed =
                      message.role === "assistant"
                        ? parseRecommendations(rawText)
                        : { cleanedText: rawText, recommendations: [] };

                    return (
                      <Message key={message.id} from={message.role}>
                        <MessageContent>
                          {parsed.cleanedText ? (
                            <MessageResponse>{parsed.cleanedText}</MessageResponse>
                          ) : null}
                          {parsed.recommendations.length > 0 ? (
                            <div className="mt-1 flex w-full flex-col gap-2">
                              {parsed.recommendations.map((recommendation) => (
                                (() => {
                                  const mappedEvent = eventById.get(recommendation.id);
                                  return (
                                <EventRecommendationCard
                                  key={`${message.id}-${recommendation.id}`}
                                  title={recommendation.title}
                                  genre={recommendation.genre}
                                  venueName={recommendation.venueName}
                                  minPrice={recommendation.minPrice}
                                  directionsUrl={getDirectionsUrl(mappedEvent)}
                                  onClick={() => {
                                    if (mappedEvent) {
                                      onSelectEvent(mappedEvent);
                                    }
                                  }}
                                />
                                  );
                                })()
                              ))}
                            </div>
                          ) : null}
                        </MessageContent>
                      </Message>
                    );
                  })
                )}

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    Something went wrong in chat. Please try again.
                  </div>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <CardContent>
              <form
                className="flex flex-col gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const trimmed = input.trim();
                  if (!trimmed) {
                    return;
                  }

                  setInput("");
                  await sendMessage(
                    { text: trimmed },
                    {
                      body: {
                        context: {
                          events: compactEvents(events),
                          preferences: {
                            dateFrom: filters.dateFrom || undefined,
                            dateTo: filters.dateTo || undefined,
                            genres: filters.genres.length > 0 ? filters.genres : undefined,
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
                <Textarea
                  suppressHydrationWarning
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={3}
                  placeholder="Tell me what vibe you're after..."
                  className="resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="px-1 text-xs text-muted-foreground">
                    {status === "submitted" || status === "streaming" ? "Thinking..." : "Ready"}
                  </span>
                  <Button type="submit" size="sm" disabled={!input.trim()}>
                    Send
                  </Button>
                </div>
              </form>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Dialog open={agendaDialogOpen} onOpenChange={setAgendaDialogOpen}>
        <DialogContent className="w-[min(960px,calc(100%-2rem))] gap-3 sm:max-w-[960px]">
          <DialogHeader>
            <DialogTitle>Planned agenda</DialogTitle>
            <DialogDescription>
              Day-by-day plan generated from your budget, interests, dates, and preferred pace.
            </DialogDescription>
          </DialogHeader>
          {agendaPlan ? (
            <>
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  £{agendaPlan.budget.toFixed(0)} max · {agendaPlan.dateFrom} to{" "}
                  {agendaPlan.dateTo}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => saveAgendaToPdf(agendaPlan)}
                >
                  <FileTextIcon data-icon="inline-start" />
                  Save as PDF
                </Button>
              </div>
              <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {agendaPlan.days.map((day) => (
                  <section key={`agenda-dialog-${day.date}`} className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      {formatAgendaDate(day.date)}
                    </h4>
                    {day.events.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {day.events.map((event) => (
                          <EventRecommendationCard
                            key={`agenda-dialog-${day.date}-${event.id}`}
                            title={event.title}
                            genre={event.genre}
                            venueName={event.venueName}
                            minPrice={event.minPrice}
                            directionsUrl={getDirectionsUrl(event)}
                            onClick={() => onSelectEvent(event)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No matching events for this day.</p>
                    )}
                  </section>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Build an agenda first to open it here.</p>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
