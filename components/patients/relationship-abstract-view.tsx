import { getLocale, getTranslations } from "next-intl/server";
import { VaultMarkdown } from "@/components/admin/vault-markdown";

export async function RelationshipAbstractView({
  abstractMd,
  updatedAt,
}: {
  abstractMd: string;
  updatedAt: Date | null;
}) {
  const t = await getTranslations("relationship");
  const locale = await getLocale();

  if (!abstractMd.trim()) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-muted-foreground">
        {t("abstractEmpty")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <VaultMarkdown raw={abstractMd} pageIndex={[]} />
      {updatedAt ? (
        <p className="mt-6 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          {t("updatedAt", {
            date: updatedAt.toLocaleString(
              locale === "en" ? "en-GB" : "fr-FR",
              {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }
            ),
          })}
        </p>
      ) : null}
    </div>
  );
}
