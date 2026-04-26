import "server-only";
import { cookies } from "next/headers";

export type Locale = "fr" | "en";

export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALES: Locale[] = ["fr", "en"];
export const LOCALE_COOKIE = "clinic_os_locale";

export const LOCALE_LABEL: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

export const LOCALE_SHORT: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
};

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

export function isLocale(value: unknown): value is Locale {
  return value === "fr" || value === "en";
}
