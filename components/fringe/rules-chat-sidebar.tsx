"use client";

import { useMemo, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, MessageSquareIcon } from "lucide-react";

import type { DiscoveryFilters } from "@/components/fringe/search-bar";
import type { EventSummary } from "@/lib/fringe/types";

type ChatRecommendation = {
  id: string;
  title: string;
  genre: string;
  venueName: string;
  minPrice: number | null;
  firstPerformanceStart: string | null;
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
  }));
}

function formatPrice(price: number | null) {
  return typeof price === "number" ? `£${price.toFixed(0)}` : "Price unknown";
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

export function RulesChatSidebar({
  events,
  filters,
  collapsed,
  onCollapsedChange,
  onSelectEvent,
}: RulesChatSidebarProps) {
  const [input, setInput] = useState("");
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
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
            <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
              <MessageSquareIcon className="size-4 text-muted-foreground" />
              <div className="flex flex-col gap-0.5">
                <CardTitle className="text-sm">Fringe assistant</CardTitle>
                <p className="text-xs text-muted-foreground">Rules chat powered by AI SDK.</p>
              </div>
            </div>
          )}
          <Collapsible open={!collapsed} onOpenChange={(open) => onCollapsedChange(!open)}>
            <CollapsibleTrigger
              render={
                <Button type="button" variant="outline" size="icon-sm">
                  {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                </Button>
              }
            />
          </Collapsible>
        </div>
      </CardHeader>

      {collapsed ? null : (
        <Collapsible open={!collapsed}>
          <CollapsibleContent className="flex min-h-0 flex-1 flex-col">
            <Conversation className="min-h-0">
              <ConversationContent className="max-h-full overflow-y-auto gap-4 p-3">
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
                                <button
                                  key={`${message.id}-${recommendation.id}`}
                                  type="button"
                                  className="w-full rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-left transition hover:bg-accent/40"
                                  onClick={() => {
                                    const event = eventById.get(recommendation.id);
                                    if (event) {
                                      onSelectEvent(event);
                                    }
                                  }}
                                >
                                  <p className="truncate text-xs font-medium">{recommendation.title}</p>
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {recommendation.genre} · {recommendation.venueName} ·{" "}
                                    {formatPrice(recommendation.minPrice)}
                                  </p>
                                </button>
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
    </Card>
  );
}
