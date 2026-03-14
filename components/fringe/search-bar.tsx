"use client";

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

function toggle(
  current: DiscoveryFilters,
  key:
    | "hasAudioDescription"
    | "hasCaptioning"
    | "hasSigned"
    | "hasOtherAccessibility",
) {
  return {
    ...current,
    [key]: !current[key],
  };
}

export function SearchBar({
  value,
  availableGenres,
  loading,
  onChange,
  onApply,
}: SearchBarProps) {
  return (
    <section className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur md:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-900 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            fringesearch
          </span>
          <span className="text-xs text-zinc-500">Edinburgh Fringe 2025</span>
        </div>
      </div>

      <form
        className="mx-auto flex w-full max-w-[1500px] flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <div className="grid gap-3 rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <label className="flex flex-col rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            Preferences
            <input
              value={value.query}
              onChange={(event) =>
                onChange({
                  ...value,
                  query: event.target.value,
                })
              }
              placeholder="Comedy, family, late-night..."
              className="mt-1 bg-transparent text-sm font-medium text-zinc-900 outline-none"
            />
          </label>

          <label className="flex flex-col rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            From
            <input
              type="date"
              value={value.dateFrom}
              onChange={(event) =>
                onChange({
                  ...value,
                  dateFrom: event.target.value,
                })
              }
              className="mt-1 bg-transparent text-sm font-medium text-zinc-900 outline-none"
            />
          </label>

          <label className="flex flex-col rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            To
            <input
              type="date"
              value={value.dateTo}
              onChange={(event) =>
                onChange({
                  ...value,
                  dateTo: event.target.value,
                })
              }
              className="mt-1 bg-transparent text-sm font-medium text-zinc-900 outline-none"
            />
          </label>

          <label className="flex flex-col rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            Genre
            <select
              value={value.genre}
              onChange={(event) =>
                onChange({
                  ...value,
                  genre: event.target.value,
                })
              }
              className="mt-1 bg-transparent text-sm font-medium text-zinc-900 outline-none"
            >
              <option value="">No preference</option>
              {availableGenres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={loading}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-700">
          <label className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5">
            Price under
            <input
              type="number"
              min={0}
              value={value.priceTo}
              onChange={(event) =>
                onChange({
                  ...value,
                  priceTo: event.target.value,
                })
              }
              className="w-16 bg-transparent text-sm font-medium text-zinc-900 outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => onChange(toggle(value, "hasAudioDescription"))}
            className={`rounded-full border px-3 py-1.5 transition ${
              value.hasAudioDescription
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            Audio description
          </button>

          <button
            type="button"
            onClick={() => onChange(toggle(value, "hasCaptioning"))}
            className={`rounded-full border px-3 py-1.5 transition ${
              value.hasCaptioning
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            Captioning
          </button>

          <button
            type="button"
            onClick={() => onChange(toggle(value, "hasSigned"))}
            className={`rounded-full border px-3 py-1.5 transition ${
              value.hasSigned
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            Signed
          </button>

          <button
            type="button"
            onClick={() => onChange(toggle(value, "hasOtherAccessibility"))}
            className={`rounded-full border px-3 py-1.5 transition ${
              value.hasOtherAccessibility
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            Other access
          </button>
        </div>
      </form>
    </section>
  );
}
