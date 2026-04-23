import Link from "next/link";
import {
  Book,
  BookOpen,
  Calendar,
  Ear,
  Headphones,
  MessageCircle,
  Network,
  Phone,
  Recycle,
  Star,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Star,
  Users,
  Phone,
  Headphones,
  Network,
  UserPlus,
  MessageCircle,
  Ear,
  Recycle,
  Calendar,
  Book,
  BookOpen,
};

export type ProgramCardProps = {
  slug: string;
  title: string;
  description: string;
  icon: string | null;
  isAvailable: boolean;
  chunkCount?: number;
  fileCount?: number;
};

export function ProgramCard(props: ProgramCardProps) {
  const Icon = ICONS[props.icon ?? ""] ?? BookOpen;
  const { isAvailable, slug, title, description, chunkCount, fileCount } = props;

  const inner = (
    <article
      className={cn(
        "group relative flex h-full flex-col gap-4 rounded-xl border bg-surface p-5 transition-all",
        isAvailable
          ? "border-border hover:border-brand/50 hover:shadow-[0_8px_24px_-12px_rgba(204,6,65,0.22)]"
          : "border-dashed border-border opacity-60"
      )}
    >
      <div
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg",
          isAvailable ? "bg-brand/10 text-brand" : "bg-surface-muted text-muted-foreground"
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
      </div>

      <div className="flex flex-col gap-1.5">
        <h3
          className={cn(
            "text-base font-semibold tracking-tight",
            isAvailable ? "text-ink" : "text-muted-foreground"
          )}
        >
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs">
        {isAvailable ? (
          <>
            <span className="text-muted-foreground">
              {fileCount ?? 0} fichier{(fileCount ?? 0) > 1 ? "s" : ""} ·{" "}
              <span className="tabular-nums text-ink">{chunkCount ?? 0}</span> chunks
            </span>
            <span className="text-brand transition-transform group-hover:translate-x-0.5">
              Ouvrir →
            </span>
          </>
        ) : (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Bientôt disponible
          </span>
        )}
      </div>
    </article>
  );

  if (!isAvailable) return inner;

  return (
    <Link
      href={`/catalogue/${slug}`}
      className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted rounded-xl"
    >
      {inner}
    </Link>
  );
}
