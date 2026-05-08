import {
  BookOpen,
  Database,
  LayoutDashboard,
  Notebook,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./role";

export type NavKey =
  | "dashboard"
  | "patients"
  | "catalogue"
  | "knowledge"
  | "memory";

export type NavItem = {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  match?: "exact" | "prefix";
};

export const PRIMARY_NAV: NavItem[] = [
  {
    key: "dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ["audioprothesiste", "assistant"],
    match: "exact",
  },
  {
    key: "patients",
    href: "/patients",
    icon: Users,
    roles: ["audioprothesiste", "assistant"],
  },
  {
    key: "catalogue",
    href: "/catalogue",
    icon: BookOpen,
    roles: ["audioprothesiste", "assistant"],
  },
];

export const ADMIN_NAV: NavItem[] = [
  {
    key: "knowledge",
    href: "/admin/knowledge",
    icon: Database,
    roles: ["audioprothesiste", "assistant"],
  },
  {
    key: "memory",
    href: "/admin/vault",
    icon: Notebook,
    roles: ["audioprothesiste", "assistant"],
  },
];

export function filterNavByRole(items: NavItem[], role: Role): NavItem[] {
  return items.filter((item) => item.roles.includes(role));
}
