import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE, AUTH_USERNAME } from "./auth-shared";

export type AuthUser = { name: string };

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(AUTH_COOKIE)?.value;
  if (!value) return null;
  if (value !== AUTH_USERNAME) return null;
  return { name: value };
}
