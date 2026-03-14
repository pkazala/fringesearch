"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

type DatePickerProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  minDate?: string;
  maxDate?: string;
  className?: string;
};

function parseDate(value: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toDateInputValue(value: Date | undefined) {
  if (!value) {
    return "";
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = useMemo(() => parseDate(value), [value]);
  const minDateValue = useMemo(() => parseDate(minDate ?? ""), [minDate]);
  const maxDateValue = useMemo(() => parseDate(maxDate ?? ""), [maxDate]);
  const label = selectedDate
    ? selectedDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start gap-2 text-left font-normal",
            !selectedDate && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon data-icon="inline-start" />
          {label}
        </Button>
      } />
      <PopoverContent className="w-auto p-0" sideOffset={8}>
        <Calendar
          mode="single"
          selected={selectedDate}
          startMonth={minDateValue}
          endMonth={maxDateValue}
          disabled={(date) =>
            Boolean(
              (minDateValue && date < minDateValue) ||
                (maxDateValue && date > maxDateValue),
            )
          }
          onSelect={(next) => {
            onChange(toDateInputValue(next));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
