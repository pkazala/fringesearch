import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { filterByIntent } from "@/lib/fringe/ranking";
import type { EventSummary } from "@/lib/fringe/types";

export const maxDuration = 30;

type ChatContext = {
  events?: EventSummary[];
  preferences?: {
    dateFrom?: string;
    dateTo?: string;
    genres?: string[];
    priceTo?: number;
    accessibility?: string[];
  };
};

type ChatRecommendation = {
  id: string;
  title: string;
  genre: string;
  venueName: string;
  minPrice: number | null;
  firstPerformanceStart: string | null;
};

const CLARIFICATION_REPLY =
  "I couldn't understand your request yet. Tell me one or two specifics, like genre, budget, dates, or accessibility needs.";

function tokenizePrompt(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function hasIntentOverlap(intentTokens: string[], events: EventSummary[]) {
  if (intentTokens.length === 0 || events.length === 0) {
    return false;
  }

  return events.some((event) => {
    const searchable =
      `${event.title} ${event.genre} ${event.venueName} ${event.description}`.toLowerCase();
    return intentTokens.some((token) => searchable.includes(token));
  });
}

function hasStructuredPreferenceSignal(prompt: string) {
  return /(under|below|max|budget|price|cheap|date|dates|from|to|between|weekend|morning|afternoon|evening|night|accessible|caption|signed|audio|genre|comedy|theatre|music|dance|family|kids|children|near)/i.test(
    prompt,
  );
}

function shouldAskForClarification(userPrompt: string, context: ChatContext) {
  const trimmedPrompt = userPrompt.trim();
  if (trimmedPrompt.length < 3) {
    return true;
  }

  const tokens = tokenizePrompt(trimmedPrompt);
  if (tokens.length === 0) {
    return true;
  }

  const contextEvents = context.events ?? [];
  if (contextEvents.length === 0) {
    return false;
  }

  if (hasIntentOverlap(tokens, contextEvents)) {
    return false;
  }

  return !hasStructuredPreferenceSignal(trimmedPrompt);
}

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

function selectRecommendations(userPrompt: string, context: ChatContext) {
  const events = context.events ?? [];
  const topMatches = filterByIntent(events, userPrompt).slice(0, 6);

  const budgetMatch = userPrompt.match(/(under|below|max)\s*£?\s*(\d{1,3})/i);
  const inferredBudget = budgetMatch ? Number(budgetMatch[2]) : null;

  const withinBudget =
    inferredBudget === null
      ? topMatches
      : topMatches.filter(
          (event) => event.minPrice === null || event.minPrice <= inferredBudget,
        );

  const finalMatches = withinBudget.length > 0 ? withinBudget : topMatches;
  return finalMatches.map((event) => ({
    id: event.id,
    title: event.title,
    genre: event.genre,
    venueName: event.venueName,
    minPrice: event.minPrice,
    firstPerformanceStart: event.firstPerformanceStart,
  }));
}

function formatRecommendationsBlock(recommendations: ChatRecommendation[]) {
  return `\n\n\`\`\`recs\n${JSON.stringify(recommendations, null, 2)}\n\`\`\``;
}

function buildSystemPrompt(context: ChatContext, recommendations: ChatRecommendation[]) {
  const preferenceBits: string[] = [];

  if (context.preferences?.dateFrom && context.preferences?.dateTo) {
    preferenceBits.push(`dates ${context.preferences.dateFrom} to ${context.preferences.dateTo}`);
  }
  if (Array.isArray(context.preferences?.genres) && context.preferences.genres.length > 0) {
    preferenceBits.push(`genres ${context.preferences.genres.join(", ")}`);
  }
  if (typeof context.preferences?.priceTo === "number") {
    preferenceBits.push(`budget up to £${context.preferences.priceTo}`);
  }
  if (Array.isArray(context.preferences?.accessibility) && context.preferences.accessibility.length > 0) {
    preferenceBits.push(`accessibility ${context.preferences.accessibility.join(", ")}`);
  }

  return [
    "You are the fringesearch assistant for Edinburgh Fringe 2025.",
    "Be concise and practical. Keep your response to 3-6 short bullet points.",
    "Use only the supplied event context. Do not invent events.",
    "Mention why each suggestion matches the user intent.",
    "Do not include JSON in your natural-language response.",
    preferenceBits.length > 0 ? `Current active filters: ${preferenceBits.join("; ")}.` : "No active filters are currently set.",
    recommendations.length > 0
      ? `You already have ${recommendations.length} preselected recommendations with exact IDs to reference in your summary.`
      : "No strong recommendations were found; ask one concise follow-up preference question.",
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages?: UIMessage[];
    context?: ChatContext;
  };

  const messages = body.messages ?? [];
  const userPrompt = getLastUserText(messages);
  const context = body.context ?? {};
  const askForClarification = shouldAskForClarification(userPrompt, context);

  if (askForClarification) {
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const id = "rules-assistant";
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: CLARIFICATION_REPLY });
        writer.write({ type: "text-end", id });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  const recommendations = selectRecommendations(userPrompt, context);
  const eventsForPrompt = (context.events ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    genre: event.genre,
    venueName: event.venueName,
    minPrice: event.minPrice,
    firstPerformanceStart: event.firstPerformanceStart,
    score: event.score,
    scoreReasons: event.scoreReasons.slice(0, 2),
    description: event.description.slice(0, 220),
  }));
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();

  if (!openAiApiKey) {
    const fallbackReply =
      "OPENAI_API_KEY is missing on the server, so I can’t run live AI recommendations right now. Add it to `.env` and try again." +
      (recommendations.length > 0 ? formatRecommendationsBlock(recommendations) : "");
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const id = "rules-assistant";
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: fallbackReply });
        writer.write({ type: "text-end", id });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  const openai = createOpenAI({
    apiKey: openAiApiKey,
  });

  const result = streamText({
    model: openai("gpt-4o-mini"),
    temperature: 0.3,
    maxOutputTokens: 450,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(context, recommendations),
      },
      {
        role: "system",
        content: `Current events context (JSON):\n${JSON.stringify(eventsForPrompt)}`,
      },
      ...messages.map((message) => ({
        role: message.role,
        content: readMessageText(message),
      })),
    ],
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const id = "rules-assistant";
      writer.write({ type: "text-start", id });

      for await (const chunk of result.textStream) {
        writer.write({
          type: "text-delta",
          id,
          delta: chunk,
        });
      }
      writer.write({
        type: "text-delta",
        id,
        delta: recommendations.length > 0 ? formatRecommendationsBlock(recommendations) : "",
      });

      writer.write({ type: "text-end", id });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
