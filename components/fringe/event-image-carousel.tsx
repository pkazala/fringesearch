"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageOffIcon } from "lucide-react";
import Image from "next/image";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

type EventImageCarouselProps = {
  imageUrls: string[];
  title: string;
  className?: string;
  aspectClassName?: string;
};

function EventImage({
  src,
  title,
  index,
  onError,
}: {
  src: string;
  title: string;
  index: number;
  onError: () => void;
}) {
  return (
    <Image
      src={src}
      alt={`${title} image ${index + 1}`}
      fill
      sizes="(max-width: 768px) 90vw, 420px"
      onError={onError}
      className="object-cover"
    />
  );
}

export function EventImageCarousel({
  imageUrls,
  title,
  className,
  aspectClassName = "aspect-[16/10]",
}: EventImageCarouselProps) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const dedupedUrls = useMemo(() => [...new Set(imageUrls.filter(Boolean))], [imageUrls]);

  const validUrls = useMemo(
    () => dedupedUrls.filter((url) => !failedUrls.includes(url)),
    [dedupedUrls, failedUrls],
  );

  useEffect(() => {
    if (!api) {
      return;
    }

    const onSelect = () => {
      setCurrentSlide(api.selectedScrollSnap());
    };

    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);

    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, validUrls.length]);

  const activeSlide = Math.min(currentSlide, Math.max(validUrls.length - 1, 0));

  if (validUrls.length === 0) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100",
          aspectClassName,
          className,
        )}
      >
        <div className="flex h-full w-full items-center justify-center gap-2 text-xs text-zinc-500">
          <ImageOffIcon className="size-4" />
          <span>No image available</span>
        </div>
      </div>
    );
  }

  if (validUrls.length === 1) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100",
          aspectClassName,
          className,
        )}
      >
        <EventImage
          src={validUrls[0]}
          title={title}
          index={0}
          onError={() => {
            setFailedUrls((prev) => (prev.includes(validUrls[0]) ? prev : [...prev, validUrls[0]]));
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100",
        aspectClassName,
        className,
      )}
    >
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        className="h-full"
        aria-label={`${title} images carousel`}
      >
        <CarouselContent className="-ml-0 h-full">
          {validUrls.map((url, index) => (
            <CarouselItem key={`${url}-${index}`} className="h-full pl-0">
              <EventImage
                src={url}
                title={title}
                index={index}
                onError={() => {
                  setFailedUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
                }}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5">
        {validUrls.map((_, index) => (
          <span
            key={`dot-${index}`}
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-white/60",
              index === activeSlide && "bg-white",
            )}
          />
        ))}
      </div>
    </div>
  );
}
