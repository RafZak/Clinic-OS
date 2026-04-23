"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isRole, ROLE_COOKIE } from "@/lib/role";

export async function setRole(value: string) {
  if (!isRole(value)) throw new Error(`Invalid role: ${value}`);

  const cookieStore = await cookies();
  cookieStore.set(ROLE_COOKIE, value, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  revalidatePath("/", "layout");
}
