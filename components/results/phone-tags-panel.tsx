import {
  AlertCircle,
  CheckCircle2,
  Phone,
  Stethoscope,
  Thermometer,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import {
  PHONE_CALL_TYPE_LABEL,
  PHONE_CALL_TYPE_LABEL_EN,
  RECOMMENDED_ACTION_LABEL,
  RECOMMENDED_ACTION_LABEL_EN,
  LEAD_TEMPERATURE_LABEL,
  LEAD_TEMPERATURE_LABEL_EN,
  DATA_CAPTURE_LABEL,
  DATA_CAPTURE_LABEL_EN,
  type PhoneCallTags,
  type LeadTemperature,
  type DataCaptureLevel,
} from "@/lib/phone-tags";
import { cn } from "@/lib/utils";

const TEMP_TONE: Record<LeadTemperature, string> = {
  hot: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warm: "border-amber-200 bg-amber-50 text-amber-800",
  cold: "border-sky-200 bg-sky-50 text-sky-700",
  lost: "border-red-200 bg-red-50 text-red-700",
};

const CAPTURE_TONE: Record<DataCaptureLevel, string> = {
  complete: "border-emerald-200 bg-emerald-50 text-emerald-700",
  partial: "border-amber-200 bg-amber-50 text-amber-800",
  anonymous: "border-red-200 bg-red-50 text-red-700",
};

const CAPTURE_ICON: Record<DataCaptureLevel, LucideIcon> = {
  complete: CheckCircle2,
  partial: AlertCircle,
  anonymous: AlertCircle,
};

export async function PhoneTagsPanel({ tags }: { tags: PhoneCallTags }) {
  const t = await getTranslations("phoneTags");
  const locale = await getLocale();
  const isEn = locale === "en";

  const callTypeLabel = isEn
    ? PHONE_CALL_TYPE_LABEL_EN[tags.call_type]
    : PHONE_CALL_TYPE_LABEL[tags.call_type];
  const actionLabel = isEn
    ? RECOMMENDED_ACTION_LABEL_EN[tags.recommended_action]
    : RECOMMENDED_ACTION_LABEL[tags.recommended_action];
  const tempLabel = isEn
    ? LEAD_TEMPERATURE_LABEL_EN[tags.lead_temperature]
    : LEAD_TEMPERATURE_LABEL[tags.lead_temperature];
  const captureLabel = isEn
    ? DATA_CAPTURE_LABEL_EN[tags.data_capture]
    : DATA_CAPTURE_LABEL[tags.data_capture];

  const CaptureIcon = CAPTURE_ICON[tags.data_capture];

  return (
    <section className="rounded-lg border border-border bg-surface px-5 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {t("title")}
        </h2>
        <span className="text-xs text-muted-foreground">{t("subtitle")}</span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tag icon={Phone} label={t("labelType")} value={callTypeLabel} />
        <Tag icon={Stethoscope} label={t("labelAction")} value={actionLabel} />
        <Tag
          icon={Thermometer}
          label={t("labelLead")}
          value={tempLabel}
          tone={TEMP_TONE[tags.lead_temperature]}
        />
        <Tag
          icon={CaptureIcon}
          label={t("labelCapture")}
          value={captureLabel}
          tone={CAPTURE_TONE[tags.data_capture]}
        />
      </div>
      {tags.data_capture_note && (
        <p
          className={cn(
            "mt-3 rounded-md border px-3 py-2 text-xs",
            tags.data_capture === "anonymous"
              ? "border-red-200 bg-red-50/50 text-red-800"
              : "border-amber-200 bg-amber-50/50 text-amber-800"
          )}
        >
          <strong className="font-semibold">{t("noteLabel")}</strong> ·{" "}
          {tags.data_capture_note}
        </p>
      )}
    </section>
  );
}

function Tag({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5",
        tone ?? "border-border bg-surface-muted"
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

export { UserCheck };
