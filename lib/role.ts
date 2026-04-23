import "server-only";
import { cookies } from "next/headers";

export type Role = "audioprothesiste" | "assistant";

export const DEFAULT_ROLE: Role = "audioprothesiste";
export const ROLE_COOKIE = "clinic_os_role";

export const ROLE_LABEL: Record<Role, string> = {
  audioprothesiste: "Audioprothésiste",
  assistant: "Assistant accueil",
};

export async function getRole(): Promise<Role> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ROLE_COOKIE)?.value;
  return raw === "audioprothesiste" || raw === "assistant" ? raw : DEFAULT_ROLE;
}

export function isRole(value: unknown): value is Role {
  return value === "audioprothesiste" || value === "assistant";
}
