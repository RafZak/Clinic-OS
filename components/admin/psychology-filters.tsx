"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PSY_TAGS, PSY_TAG_LABEL, type PsyTag } from "@/lib/psychology/tags";

export function PsychologyFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedTags = (params.get("tags")?.split(",").filter(Boolean) ??
    []) as PsyTag[];
  const consentMode = params.get("consent") ?? "active";

  const update = (next: URLSearchParams) => {
    router.push(`/admin/psychology?${next.toString()}`);
  };

  const toggleTag = (tag: PsyTag) => {
    const next = new URLSearchParams(params);
    const set = new Set(selectedTags);
    if (set.has(tag)) set.delete(tag);
    else set.add(tag);
    if (set.size > 0) next.set("tags", [...set].join(","));
    else next.delete("tags");
    update(next);
  };

  const setConsent = (mode: string) => {
    const next = new URLSearchParams(params);
    next.set("consent", mode);
    update(next);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tags
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PSY_TAGS.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition " +
                  (active
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface-muted text-foreground hover:border-brand/40")
                }
              >
                {PSY_TAG_LABEL[tag]}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Consentement marketing
        </p>
        <div className="flex gap-1.5">
          {[
            ["active", "Consentants uniquement"],
            ["all", "Tous (avec avertissement)"],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setConsent(k)}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition " +
                (consentMode === k
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-surface-muted text-foreground")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
