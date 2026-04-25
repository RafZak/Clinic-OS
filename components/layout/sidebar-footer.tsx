import { cn } from "@/lib/utils";

const SYSTEM_STATUS = [
  { label: "Transcription", ok: true },
  { label: "IA coach", ok: true },
  { label: "Mémoire", ok: true },
];

export function SidebarFooter() {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex flex-col gap-1.5 px-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Statut système
        </p>
        <ul className="flex flex-col gap-0.5">
          {SYSTEM_STATUS.map((s) => (
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
                {s.ok ? "OK" : "panne"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="px-3 text-[10px] text-muted-foreground/70">
        Démo Amplifon · J10 · avr. 2026
      </p>
    </div>
  );
}
