"use client";

import { useState } from "react";

import { ImageOffIcon, XIcon } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getGenreEmoji } from "@/lib/fringe/genre-emoji";
import type { EventSummary } from "@/lib/fringe/types";

type EventDetailCardProps = {
  event: EventSummary;
  onClose: () => void;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDirectionsUrl(event: EventSummary) {
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

export function EventDetailCard({ event, onClose }: EventDetailCardProps) {
  const genreEmoji = getGenreEmoji(event.genre);
  const primaryImageUrl = event.imageUrls[0] ?? event.imageUrl ?? null;
  const directionsUrl = getDirectionsUrl(event);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(primaryImageUrl) && !imageFailed;

  return (
    <Card size="sm" className="h-full w-full max-w-[620px] bg-background/95 shadow-2xl backdrop-blur">
      <CardHeader className="gap-0.5">
        <CardTitle>
          <span className="mr-1.5" aria-hidden="true">
            {genreEmoji}
          </span>
          {event.title}
        </CardTitle>
        <CardDescription className="truncate">
          {event.genre} · {event.venueName}
        </CardDescription>
        <CardAction>
          <Button type="button" variant="outline" size="icon-sm" onClick={onClose} aria-label="Close details">
            <XIcon />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <div className="grid gap-2 md:grid-cols-[160px_1fr]">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
            {showImage ? (
              <Image
                src={primaryImageUrl ?? ""}
                alt={`${event.title} image`}
                fill
                sizes="(max-width: 768px) 90vw, 160px"
                quality={95}
                className="object-contain"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <ImageOffIcon />
                <span>No image</span>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{event.genre}</Badge>
              <Badge variant="outline">{event.priceLabel}</Badge>
              <Badge variant="outline">{event.venueName}</Badge>
            </div>

            <div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
              <p>
                <span className="font-medium text-foreground">When:</span>{" "}
                {formatDate(event.firstPerformanceStart)}
              </p>
              <p>
                <span className="font-medium text-foreground">Venue:</span> {event.venueAddress}
              </p>
              <p>
                <span className="font-medium text-foreground">Postcode:</span> {event.postCode}
              </p>
              <p>
                <span className="font-medium text-foreground">Score:</span> {event.score}
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{event.description}</p>

        <div className="flex flex-wrap gap-1.5">
          {event.accessibility.audio && <Badge variant="secondary">Audio description</Badge>}
          {event.accessibility.captioning && <Badge variant="secondary">Captioning</Badge>}
          {event.accessibility.signed && <Badge variant="secondary">Signed</Badge>}
          {event.accessibility.otherServices && <Badge variant="secondary">Other access</Badge>}
        </div>
      </CardContent>

      {(directionsUrl || event.website) && (
        <CardFooter className="justify-end gap-2">
          {directionsUrl && (
            <Button
              type="button"
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
          )}
          {event.website && (
            <Button
              type="button"
              render={
                <a
                  href={event.website}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              Open festival listing
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
