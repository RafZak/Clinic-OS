import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { buildPatientExportData } from "@/lib/psychology/export/build";
import { formatCsv } from "@/lib/psychology/export/format-csv";
import { formatJson } from "@/lib/psychology/export/format-json";
import { formatXlsx } from "@/lib/psychology/export/format-xlsx";
import type {
  ConsentMode,
  ExportFormat,
  ExportLocale,
} from "@/lib/psychology/export/types";

const VALID_FORMATS: ExportFormat[] = ["csv", "xlsx", "json"];
const VALID_LOCALES: ExportLocale[] = ["fr", "en"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const ids = params.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }

  const MAX_IDS = 200;
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: "too_many_ids", max: MAX_IDS, received: ids.length },
      { status: 400 }
    );
  }

  const formatParam = (params.get("format") ?? "csv") as ExportFormat;
  if (!VALID_FORMATS.includes(formatParam)) {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  const localeParam = (params.get("locale") ?? "fr") as ExportLocale;
  if (!VALID_LOCALES.includes(localeParam)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  const consentMode: ConsentMode =
    params.get("consent") === "all" ? "all" : "active";

  if (consentMode === "all") {
    console.warn(
      `[export] consent=all triggered: ids=${ids.length}, format=${formatParam}, locale=${localeParam}`
    );
  }

  const payload = await buildPatientExportData({
    ids,
    consentMode,
    locale: localeParam,
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const baseName = `clinic-os-patients-${dateStr}`;

  if (formatParam === "csv") {
    const csv = formatCsv(payload);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }

  if (formatParam === "json") {
    const json = formatJson(payload);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.json"`,
      },
    });
  }

  // xlsx
  const buffer = await formatXlsx(payload);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
    },
  });
}
