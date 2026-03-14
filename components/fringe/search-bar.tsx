"use client";

import { useMemo, useState } from "react";

import { DatePicker } from "@/components/fringe/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";

export type DiscoveryFilters = {
  query: string;
  dateFrom: string;
  dateTo: string;
  genres: string[];
  priceTo: string;
  hasAudioDescription: boolean;
  hasCaptioning: boolean;
  hasSigned: boolean;
  hasOtherAccessibility: boolean;
};

type SearchBarProps = {
  value: DiscoveryFilters;
  availableGenres: string[];
  loading: boolean;
  collapsed: boolean;
  onExpand: () => void;
  onChange: (next: DiscoveryFilters) => void;
  onApply: () => void;
};

const ACCESSIBILITY_KEYS = [
  { id: "audio", label: "Audio", key: "hasAudioDescription" as const },
  { id: "captioning", label: "Captioning", key: "hasCaptioning" as const },
  { id: "signed", label: "Signed", key: "hasSigned" as const },
  { id: "other", label: "Other Access", key: "hasOtherAccessibility" as const },
];
const FESTIVAL_DATE_FROM = "2025-08-01";
const FESTIVAL_DATE_TO = "2025-08-31";

export function SearchBar({
  value,
  availableGenres,
  loading,
  collapsed,
  onExpand,
  onChange,
  onApply,
}: SearchBarProps) {
  const [dateSelectionTouched, setDateSelectionTouched] = useState(false);
  const activeAccessValues = ACCESSIBILITY_KEYS.filter((item) => value[item.key]).map(
    (item) => item.id,
  );
  const genresLabel = useMemo(() => {
    if (value.genres.length === 0) {
      return "Choose preferences";
    }
    return `${value.genres.length} selected`;
  }, [value.genres]);

  const pillSummary = value.query.trim() ? value.query.trim() : "Search Fringe events";
  const hasCustomDateWindow =
    value.dateFrom !== FESTIVAL_DATE_FROM || value.dateTo !== FESTIVAL_DATE_TO;
  const selectedFiltersCount =
    value.genres.length +
    Number(Boolean(value.priceTo)) +
    activeAccessValues.length +
    Number(hasCustomDateWindow);
  const showDatePlaceholder =
    !dateSelectionTouched &&
    value.dateFrom === FESTIVAL_DATE_FROM &&
    value.dateTo === FESTIVAL_DATE_TO;
  const displayedDateFrom = showDatePlaceholder ? "" : value.dateFrom;
  const displayedDateTo = showDatePlaceholder ? "" : value.dateTo;

  return (
    <section
      className={cn(
        "sticky top-0 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6 motion-safe:transition-[box-shadow,background-color] motion-safe:duration-150",
        collapsed ? "z-30 shadow-sm" : "z-20",
      )}
    >
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="uppercase tracking-wide">
            fringesearch
          </Badge>
          <span className="text-xs text-muted-foreground">Edinburgh Fringe 2025</span>
        </div>
      </div>

      <div
        className={cn(
          "mx-auto flex w-full max-w-[1500px] overflow-hidden will-change-[max-height,opacity,transform] motion-safe:transition-[max-height,opacity,transform] motion-safe:duration-170 motion-safe:ease-out",
          collapsed
            ? "max-h-16 translate-y-0 opacity-100"
            : "pointer-events-none max-h-0 -translate-y-1 opacity-0",
        )}
      >
        <button
          type="button"
          onClick={onExpand}
          className="flex h-12 w-full items-center justify-between gap-3 rounded-full border bg-card px-4 text-left shadow-sm transition hover:shadow-md"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <SearchIcon className="size-4 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{pillSummary}</span>
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            {selectedFiltersCount > 0 ? `${selectedFiltersCount} filters` : "All defaults"}
            <SlidersHorizontalIcon className="size-4" />
          </span>
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden will-change-[max-height,opacity,transform] motion-safe:transition-[max-height,opacity,transform] motion-safe:duration-170 motion-safe:ease-out",
          collapsed
            ? "pointer-events-none max-h-0 -translate-y-1 opacity-0"
            : "max-h-[820px] translate-y-0 opacity-100",
        )}
      >
        <div className="mx-auto w-full max-w-[1500px] rounded-2xl border border-border/80 bg-background p-3 shadow-sm">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              onApply();
            }}
          >
            <Card className="border-0 shadow-none">
              <CardContent className="flex flex-col gap-4 p-0">
                <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1.2fr_auto]">
                  <Input
                    suppressHydrationWarning
                    value={value.query}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        query: event.target.value,
                      })
                    }
                    placeholder="Comedy, family, late-night..."
                  />

                  <DatePicker
                    value={displayedDateFrom}
                    onChange={(next) => {
                      setDateSelectionTouched(true);
                      onChange({
                        ...value,
                        dateFrom: next || FESTIVAL_DATE_FROM,
                      });
                    }}
                    placeholder="Choose dates"
                    minDate={FESTIVAL_DATE_FROM}
                    maxDate={FESTIVAL_DATE_TO}
                  />

                  <DatePicker
                    value={displayedDateTo}
                    onChange={(next) => {
                      setDateSelectionTouched(true);
                      onChange({
                        ...value,
                        dateTo: next || FESTIVAL_DATE_TO,
                      });
                    }}
                    placeholder="Choose dates"
                    minDate={FESTIVAL_DATE_FROM}
                    maxDate={FESTIVAL_DATE_TO}
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between gap-2 px-3 font-normal"
                        >
                          <span
                            className={cn(
                              "truncate text-left",
                              value.genres.length === 0 && "text-muted-foreground",
                            )}
                          >
                            {genresLabel}
                          </span>
                          <ChevronDownIcon className="size-4 text-muted-foreground" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="start" className="w-[--anchor-width] min-w-64">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Choose preferences</DropdownMenuLabel>
                        {availableGenres.map((genre) => (
                          <DropdownMenuCheckboxItem
                            key={genre}
                            checked={value.genres.includes(genre)}
                            onCheckedChange={(checked) =>
                              onChange({
                                ...value,
                                genres:
                                  checked === true
                                    ? [...value.genres, genre].filter(
                                        (item, index, all) => all.indexOf(item) === index,
                                      )
                                    : value.genres.filter((item) => item !== genre),
                              })
                            }
                          >
                            {genre}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button type="submit" disabled={loading}>
                    <SearchIcon data-icon="inline-start" />
                    {loading ? "Searching..." : "Search"}
                  </Button>
                </div>

                <Separator />

                <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
                  <Input
                    suppressHydrationWarning
                    type="number"
                    min={0}
                    value={value.priceTo}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        priceTo: event.target.value,
                      })
                    }
                    placeholder="Max price (£)"
                  />

                  <ToggleGroup
                    multiple
                    value={activeAccessValues}
                    onValueChange={(nextValues) =>
                      onChange({
                        ...value,
                        hasAudioDescription: nextValues.includes("audio"),
                        hasCaptioning: nextValues.includes("captioning"),
                        hasSigned: nextValues.includes("signed"),
                        hasOtherAccessibility: nextValues.includes("other"),
                      })
                    }
                    className="justify-start"
                  >
                    {ACCESSIBILITY_KEYS.map((item) => (
                      <ToggleGroupItem key={item.id} value={item.id} aria-label={item.label}>
                        {item.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </section>
  );
}
