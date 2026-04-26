"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE } from "@/lib/locale";

export async function setLocale(value: string) {
  if (!isLocale(value)) throw new Error(`Invalid locale: ${value}`);

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, value, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  revalidatePath("/", "layout");
}
