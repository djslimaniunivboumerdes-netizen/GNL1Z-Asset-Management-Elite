import { LoaderCircle } from "lucide-react";

export function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
      <span className="sr-only">Loading page…</span>
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="h-10 w-2/3 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((n) => <div key={n} className="h-36 animate-pulse rounded-xl border border-border bg-muted/50" />)}
      </div>
      <LoaderCircle className="mx-auto mt-10 h-5 w-5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
    </div>
  );
}
