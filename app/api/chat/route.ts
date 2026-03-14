import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

import { filterByIntent } from "@/lib/fringe/ranking";
import type { EventSummary } from "@/lib/fringe/types";

export const maxDuration = 30;

type ChatContext = {
  events?: EventSummary[];
  preferences?: {
    dateFrom?: string;
    dateTo?: string;
    genre?: string;
    priceTo?: number;
    accessibility?: string[];
  };
};

function readMessageText(message: UIMessage) {
  if (!Array.isArray(message.parts)) {
    return "";
  }

  return message.parts
    .map((part) => {
      if (part.type === "text" && "text" in part) {
        return typeof part.text === "string" ? part.text : "";
      }

      return "";
    })
    .join(" ")
    .trim();
}

function getLastUserText(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user") {
      return readMessageText(message);
    }
  }

  return "";
}

function formatPrice(price: number | null) {
  return typeof price === "number" ? `£${price.toFixed(0)}` : "Unknown";
}

function buildAssistantReply(userPrompt: string, context: ChatContext) {
  const events = context.events ?? [];
  const topMatches = filterByIntent(events, userPrompt).slice(0, 5);

  const budgetMatch = userPrompt.match(/(under|below|max)\s*£?\s*(\d{1,3})/i);
  const inferredBudget = budgetMatch ? Number(budgetMatch[2]) : null;

  const withinBudget =
    inferredBudget === null
      ? topMatches
      : topMatches.filter(
          (event) => event.minPrice === null || event.minPrice <= inferredBudget,
        );

  const finalMatches = withinBudget.length > 0 ? withinBudget : topMatches;

  const preferenceBits: string[] = [];
  if (context.preferences?.dateFrom && context.preferences?.dateTo) {
    preferenceBits.push(
      `dates ${context.preferences.dateFrom} to ${context.preferences.dateTo}`,
    );
  }
  if (context.preferences?.genre) {
    preferenceBits.push(`genre ${context.preferences.genre}`);
  }
  if (typeof context.preferences?.priceTo === "number") {
    preferenceBits.push(`budget up to £${context.preferences.priceTo}`);
  }

  const intro =
    preferenceBits.length > 0
      ? `I considered your current filters (${preferenceBits.join(", ")}) plus your latest note.`
      : "I used your latest note and current search context.";

  if (finalMatches.length === 0) {
    return `${intro}\n\nI couldn't find strong matches yet. Try adding a genre, a budget, or a date like "comedy under £15 on Aug 10".`;
  }

  const bullets = finalMatches
    .map((event, index) => {
      const reasons = event.scoreReasons.slice(0, 2).join("; ");
      const performance = event.firstPerformanceStart
        ? new Date(event.firstPerformanceStart).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "time unknown";

      return `${index + 1}. ${event.title} — ${event.genre} at ${event.venueName} (${performance}, from ${formatPrice(event.minPrice)})${reasons ? ` | Why: ${reasons}` : ""}`;
    })
    .join("\n");

  return `${intro}\n\nHere are my best Fringe 2025 picks:\n${bullets}\n\nIf you want, I can narrow to "cheapest", "closest", "later tonight", or accessibility-first options.`;
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages?: UIMessage[];
    context?: ChatContext;
  };

  const messages = body.messages ?? [];
  const userPrompt = getLastUserText(messages);

  const assistantReply = buildAssistantReply(userPrompt, body.context ?? {});

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = "rules-assistant";
      writer.write({ type: "text-start", id });

      const chunks = assistantReply.match(/.{1,120}(\s|$)/g) ?? [assistantReply];
      for (const chunk of chunks) {
        writer.write({
          type: "text-delta",
          id,
          delta: chunk,
        });
      }

      writer.write({ type: "text-end", id });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
