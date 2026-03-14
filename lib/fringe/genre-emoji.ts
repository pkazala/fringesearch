const CATEGORY_EMOJI_RULES: Array<{ keywords: string[]; emoji: string }> = [
  { keywords: ["theatre", "theater", "drama", "play"], emoji: "🎭" },
  { keywords: ["comedy", "stand-up", "stand up", "improv"], emoji: "🤣" },
  { keywords: ["dance", "ballet", "choreography"], emoji: "🕺" },
  { keywords: ["music", "concert", "band", "opera", "choir"], emoji: "🎵" },
  { keywords: ["cabaret", "burlesque"], emoji: "🎪" },
  { keywords: ["magic", "illusion"], emoji: "🪄" },
  { keywords: ["family", "kids", "children"], emoji: "👨‍👩‍👧‍👦" },
  { keywords: ["spoken word", "poetry"], emoji: "📝" },
  { keywords: ["circus"], emoji: "🤹" },
  { keywords: ["film", "cinema"], emoji: "🎬" },
];

export function getGenreEmoji(genre: string) {
  const normalized = genre.trim().toLowerCase();

  for (const rule of CATEGORY_EMOJI_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.emoji;
    }
  }

  return "🎟️";
}
