"use client";

import { DatePicker } from "@/components/fringe/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SearchIcon } from "lucide-react";

export type DiscoveryFilters = {
  query: string;
  dateFrom: string;
  dateTo: string;
  genre: string;
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
  onChange: (next: DiscoveryFilters) => void;
  onApply: () => void;
};

const ACCESSIBILITY_KEYS = [
  { id: "audio", label: "Audio", key: "hasAudioDescription" as const },
  { id: "captioning", label: "Captioning", key: "hasCaptioning" as const },
  { id: "signed", label: "Signed", key: "hasSigned" as const },
  { id: "other", label: "Other Access", key: "hasOtherAccessibility" as const },
];

export function SearchBar({
  value,
  availableGenres,
  loading,
  onChange,
  onApply,
}: SearchBarProps) {
  const activeAccessValues = ACCESSIBILITY_KEYS.filter((item) => value[item.key]).map(
    (item) => item.id,
  );

  return (
    <section className="sticky top-0 z-20 border-b bg-background/95 px-4 py-4 backdrop-blur md:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="uppercase tracking-wide">
            fringesearch
          </Badge>
          <span className="text-xs text-muted-foreground">Edinburgh Fringe 2025</span>
        </div>
      </div>

      <form
        className="mx-auto flex w-full max-w-[1500px] flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
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
                value={value.dateFrom}
                onChange={(next) =>
                  onChange({
                    ...value,
                    dateFrom: next,
                  })
                }
                placeholder="From date"
              />

              <DatePicker
                value={value.dateTo}
                onChange={(next) =>
                  onChange({
                    ...value,
                    dateTo: next,
                  })
                }
                placeholder="To date"
              />

              <Select
                value={value.genre || "__none"}
                onValueChange={(nextValue) =>
                  onChange({
                    ...value,
                    genre: nextValue && nextValue !== "__none" ? nextValue : "",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__none">No preference</SelectItem>
                    {availableGenres.map((genre) => (
                      <SelectItem key={genre} value={genre}>
                        {genre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

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
    </section>
  );
}
