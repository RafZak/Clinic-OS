import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

export async function SidebarFooter() {
  const t = await getTranslations("nav");

  const items = [
    { label: t("transcription"), ok: true },
    { label: t("aiCoach"), ok: true },
    { label: t("memorySystem"), ok: true },
  ];

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex flex-col gap-1.5 px-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("systemStatus")}
        </p>
        <ul className="flex flex-col gap-0.5">
          {items.map((s) => (
            <li
              key={s.label}
              className="flex items-center gap-2 text-[11px] text-muted-foreground"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  s.ok ? "bg-emerald-500" : "bg-red-500"
                )}
                aria-hidden
              />
              <span>{s.label}</span>
              <span className="ml-auto text-[10px] text-emerald-600/80">
                {s.ok ? t("ok") : t("down")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
