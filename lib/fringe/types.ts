export type AccessibilityFilters = {
  hasAudioDescription?: boolean;
  hasCaptioning?: boolean;
  hasSigned?: boolean;
  hasOtherAccessibility?: boolean;
};

export type EventSearchFilters = AccessibilityFilters & {
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  genre?: string;
  priceTo?: number;
  lat?: number;
  lon?: number;
  distance?: string;
  size?: number;
  from?: number;
};

export type FringeApiEvent = {
  age_category: string | null;
  artist: string | null;
  country: string | null;
  description: string | null;
  description_teaser: string | null;
  festival: string | null;
  festival_id: string | null;
  genre: string | null;
  images: Record<
    string,
    {
      orientation?: "landscape" | "portrait" | "square";
      type?: "thumb" | "hero";
      versions?: {
        original?: {
          url?: string;
        };
      };
    }
  > | null;
  latitude: number | null;
  longitude: number | null;
  performances:
    | Array<{
        price: number | null;
        concession: number | null;
        price_string: string | null;
        start: string | null;
        end: string | null;
        duration_minutes: number | null;
        title: string | null;
      }>
    | null;
  status?: "active" | "cancelled" | "deleted" | null;
  title: string | null;
  url: string;
  updated: string | null;
  venue:
    | {
        id?: string | null;
        code?: string | null;
        name?: string | null;
        post_code?: string | null;
        address?: string | null;
        position?: {
          lat?: number | null;
          lon?: number | null;
        } | null;
      }
    | null;
  website: string | null;
  disabled:
    | {
        audio?: boolean | null;
        captioning?: boolean | null;
        signed?: boolean | null;
        other_services?: boolean | null;
      }
    | null;
};

export type EventSummary = {
  id: string;
  title: string;
  description: string;
  festival: string;
  genre: string;
  venueName: string;
  venueAddress: string;
  postCode: string;
  lat: number | null;
  lon: number | null;
  website: string | null;
  status: "active" | "cancelled" | "deleted";
  imageUrl: string | null;
  artist: string;
  country: string;
  updated: string;
  minPrice: number | null;
  maxPrice: number | null;
  priceLabel: string;
  firstPerformanceStart: string | null;
  lastPerformanceEnd: string | null;
  accessibility: {
    audio: boolean;
    captioning: boolean;
    signed: boolean;
    otherServices: boolean;
  };
  score: number;
  scoreReasons: string[];
};

export type ScoredEventsResponse = {
  events: EventSummary[];
  topSuggestions: EventSummary[];
  total: number;
  availableGenres: string[];
};

export type RulesChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export type RulesChatResult = {
  recommendations: EventSummary[];
  explanation: string;
};
