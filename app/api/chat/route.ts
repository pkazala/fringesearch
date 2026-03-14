import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const maxDuration = 30;

type ChatEvent = {
  id: string;
  title: string;
  genre: string;
  venueName: string;
  minPrice: number | null;
  firstPerformanceStart: string | null;
  score?: number;
  scoreReasons?: string[];
  description?: string;
  accessibility?: {
    audio?: boolean;
    captioning?: boolean;
    signed?: boolean;
    other?: boolean;
  };
};

type ChatContext = {
  events?: ChatEvent[];
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

type SearchEventsInput = {
  query?: string;
  genres?: string[];
  maxPrice?: number;
  dateFrom?: string;
  dateTo?: string;
  accessibility?: Array<"audio" | "captioning" | "signed" | "other">;
  limit?: number;
};

type SummarizeMatchesInput = {
  eventIds?: string[];
  limit?: number;
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

function toChatRecommendation(event: ChatEvent): ChatRecommendation {
  return {
    id: event.id,
    title: event.title,
    genre: event.genre,
    venueName: event.venueName,
    minPrice: event.minPrice,
    firstPerformanceStart: event.firstPerformanceStart,
  };
}

function formatRecommendationsBlock(recommendations: ChatRecommendation[]) {
  return `\n\n\`\`\`recs\n${JSON.stringify(recommendations, null, 2)}\n\`\`\``;
}

function normalizeIsoDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

function createEventCatalog(events: ChatEvent[]) {
  return events.slice(0, 120).map((event) => ({
    id: event.id,
    title: event.title,
    genre: event.genre,
    venueName: event.venueName,
    minPrice: event.minPrice,
    firstPerformanceStart: event.firstPerformanceStart,
    score: event.score ?? 0,
    scoreReasons: Array.isArray(event.scoreReasons) ? event.scoreReasons.slice(0, 2) : [],
    description: (event.description ?? "").slice(0, 180),
    accessibility: {
      audio: Boolean(event.accessibility?.audio),
      captioning: Boolean(event.accessibility?.captioning),
      signed: Boolean(event.accessibility?.signed),
      other: Boolean(event.accessibility?.other),
    },
  }));
}

function buildPreferencesSummary(context: ChatContext) {
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

  return preferenceBits.length > 0
    ? `Current active filters: ${preferenceBits.join("; ")}.`
    : "No active filters are currently set.";
}

function buildAgentSystemPrompt(context: ChatContext) {
  return [
    "You are the fringesearch autonomous agent for Edinburgh Fringe 2025.",
    "You must decide whether to ask a concise follow-up question or recommend events now.",
    "Use tools when forming recommendations:",
    "- Use search_events to retrieve relevant candidates from catalog data.",
    "- Use summarize_matches to lock in final recommendation IDs for UI cards.",
    "If user intent is unclear or missing key constraints, ask exactly one focused follow-up question and do not call summarize_matches.",
    "When enough context exists, call search_events then summarize_matches, then respond with 3-6 concise bullet points.",
    "Never invent events or IDs. IDs must come from tool results.",
    "Do not output JSON in the natural-language response.",
    buildPreferencesSummary(context),
  ].join("\n");
}

const LOCAL_ENV_FILES_IN_PRIORITY = [
  ".env.development.local",
  ".env.local",
  ".env.development",
  ".env",
] as const;

function parseEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function readLocalEnvKey(key: string) {
  for (const fileName of LOCAL_ENV_FILES_IN_PRIORITY) {
    const absolutePath = join(process.cwd(), fileName);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const fileContent = readFileSync(absolutePath, "utf8");
    const lines = fileContent.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const normalizedLine = line.startsWith("export ") ? line.slice(7).trim() : line;
      const separatorIndex = normalizedLine.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const parsedKey = normalizedLine.slice(0, separatorIndex).trim();
      if (parsedKey !== key) {
        continue;
      }

      const rawValue = normalizedLine.slice(separatorIndex + 1);
      const parsedValue = parseEnvValue(rawValue);
      if (parsedValue) {
        return parsedValue;
      }
    }
  }

  return undefined;
}

function resolveOpenAiApiKey() {
  const localEnvKey = readLocalEnvKey("OPENAI_API_KEY");
  if (localEnvKey) {
    return localEnvKey;
  }
  return process.env.OPENAI_API_KEY?.trim();
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages?: UIMessage[];
    context?: ChatContext;
  };

  const messages = body.messages ?? [];
  const context = body.context ?? {};
  const contextEvents = context.events ?? [];
  const eventsById = new Map(contextEvents.map((event) => [event.id, event]));
  const openAiApiKey = resolveOpenAiApiKey();

  if (!openAiApiKey) {
    const fallbackReply =
      "OPENAI_API_KEY is missing on the server, so I can’t run live AI recommendations right now. Add it to `.env` and try again.";
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

  const catalog = createEventCatalog(contextEvents);
  let latestSearchResults: ChatRecommendation[] = [];
  let selectedRecommendations: ChatRecommendation[] = [];

  const result = streamText({
    model: openai("gpt-4o-mini"),
    temperature: 0.35,
    maxOutputTokens: 550,
    stopWhen: stepCountIs(6),
    tools: {
      search_events: tool({
        description:
          "Searches event catalog with optional filters and returns ranked candidate matches.",
        inputSchema: jsonSchema<SearchEventsInput>({
          type: "object",
          properties: {
            query: { type: "string" },
            genres: { type: "array", items: { type: "string" } },
            maxPrice: { type: "number" },
            dateFrom: { type: "string" },
            dateTo: { type: "string" },
            accessibility: {
              type: "array",
              items: {
                type: "string",
                enum: ["audio", "captioning", "signed", "other"],
              },
            },
            limit: { type: "number" },
          },
          additionalProperties: false,
        }),
        execute: async (input: SearchEventsInput) => {
          const query = typeof input.query === "string" ? input.query.trim() : "";
          const queryTokens = tokenize(query);
          const genreSet = new Set(
            Array.isArray(input.genres)
              ? input.genres
                  .filter((entry) => typeof entry === "string")
                  .map((entry) => entry.toLowerCase())
              : [],
          );
          const maxPrice = typeof input.maxPrice === "number" ? input.maxPrice : null;
          const dateFrom = normalizeIsoDate(
            typeof input.dateFrom === "string" ? input.dateFrom : null,
          );
          const dateTo = normalizeIsoDate(typeof input.dateTo === "string" ? input.dateTo : null);
          const accessibilitySet = new Set(
            Array.isArray(input.accessibility)
              ? input.accessibility.filter(
                  (entry) =>
                    entry === "audio" ||
                    entry === "captioning" ||
                    entry === "signed" ||
                    entry === "other",
                )
              : [],
          );
          const limit = Math.min(
            Math.max(typeof input.limit === "number" ? Math.floor(input.limit) : 8, 3),
            20,
          );

          const scored = contextEvents
            .filter((event) => {
              if (genreSet.size > 0 && !genreSet.has(event.genre.toLowerCase())) {
                return false;
              }
              if (maxPrice !== null && event.minPrice !== null && event.minPrice > maxPrice) {
                return false;
              }
              if (accessibilitySet.has("audio") && !event.accessibility?.audio) {
                return false;
              }
              if (accessibilitySet.has("captioning") && !event.accessibility?.captioning) {
                return false;
              }
              if (accessibilitySet.has("signed") && !event.accessibility?.signed) {
                return false;
              }
              if (accessibilitySet.has("other") && !event.accessibility?.other) {
                return false;
              }

              const eventDate = normalizeIsoDate(event.firstPerformanceStart);
              if (dateFrom && eventDate && eventDate < dateFrom) {
                return false;
              }
              if (dateTo && eventDate && eventDate > dateTo) {
                return false;
              }
              return true;
            })
            .map((event) => {
              const haystack =
                `${event.title} ${event.genre} ${event.venueName} ${event.description ?? ""}`.toLowerCase();
              const tokenScore =
                queryTokens.length === 0
                  ? 0
                  : queryTokens.reduce((acc, token) => acc + (haystack.includes(token) ? 1 : 0), 0);
              const semanticScore = event.score ?? 0;
              return {
                event,
                score: tokenScore * 8 + semanticScore,
              };
            })
            .filter((entry) => (queryTokens.length > 0 ? entry.score > 0 : true))
            .sort((a, b) => b.score - a.score);

          const matches = scored.slice(0, limit).map((entry) => toChatRecommendation(entry.event));
          latestSearchResults = matches;

          return {
            totalMatches: scored.length,
            matches,
          };
        },
      }),
      summarize_matches: tool({
        description:
          "Finalizes recommendation IDs for UI cards. Prefer calling this after search_events.",
        inputSchema: jsonSchema<SummarizeMatchesInput>({
          type: "object",
          properties: {
            eventIds: {
              type: "array",
              items: { type: "string" },
            },
            limit: { type: "number" },
          },
          additionalProperties: false,
        }),
        execute: async (input: SummarizeMatchesInput) => {
          const limit = Math.min(
            Math.max(typeof input.limit === "number" ? Math.floor(input.limit) : 6, 3),
            6,
          );
          const idsFromInput = Array.isArray(input.eventIds)
            ? input.eventIds.filter((id) => typeof id === "string")
            : [];

          const chosenEvents =
            idsFromInput.length > 0
              ? idsFromInput
                  .map((id) => eventsById.get(id))
                  .filter((event): event is ChatEvent => Boolean(event))
              : latestSearchResults
                  .map((entry) => eventsById.get(entry.id))
                  .filter((event): event is ChatEvent => Boolean(event));

          const deduped: ChatEvent[] = [];
          const seen = new Set<string>();
          for (const event of chosenEvents) {
            if (!seen.has(event.id)) {
              seen.add(event.id);
              deduped.push(event);
            }
          }

          selectedRecommendations = deduped.slice(0, limit).map(toChatRecommendation);

          return {
            count: selectedRecommendations.length,
            recommendations: selectedRecommendations,
          };
        },
      }),
    },
    messages: [
      {
        role: "system",
        content: buildAgentSystemPrompt(context),
      },
      {
        role: "system",
        content: `Event catalog for tool context (JSON):\n${JSON.stringify(catalog)}`,
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
        delta:
          selectedRecommendations.length > 0
            ? formatRecommendationsBlock(selectedRecommendations)
            : "",
      });

      writer.write({ type: "text-end", id });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
