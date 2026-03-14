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

type RulesChatSidebarProps = {
  events: EventSummary[];
  filters: DiscoveryFilters;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
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

export function RulesChatSidebar({
  events,
  filters,
  collapsed,
  onCollapsedChange,
}: RulesChatSidebarProps) {
  const [input, setInput] = useState("");
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
    <Card className="flex min-h-[420px] flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-2">
          <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
            <MessageSquareIcon className="size-4 text-muted-foreground" />
            {!collapsed && (
              <div className="flex flex-col gap-0.5">
                <CardTitle className="text-sm">Fringe assistant</CardTitle>
                <p className="text-xs text-muted-foreground">Rules chat powered by AI SDK.</p>
              </div>
            )}
          </div>
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

      {collapsed ? (
        <CardContent className="flex flex-1 items-center justify-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onCollapsedChange(false)}
          >
            Open chat
          </Button>
        </CardContent>
      ) : (
        <Collapsible open={!collapsed}>
          <CollapsibleContent className="flex flex-1 flex-col">
            <Conversation className="min-h-0">
              <ConversationContent className="gap-4 p-3">
                {messages.length === 0 ? (
                  <ConversationEmptyState
                    title="Start chatting"
                    description="Try: cheap comedy on my dates, or accessible family events near city centre."
                  />
                ) : (
                  messages.map((message) => (
                    <Message key={message.id} from={message.role}>
                      <MessageContent>
                        {message.parts.map((part, index) =>
                          part.type === "text" ? (
                            <MessageResponse key={`${message.id}-${index}`}>
                              {part.text}
                            </MessageResponse>
                          ) : null,
                        )}
                      </MessageContent>
                    </Message>
                  ))
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
