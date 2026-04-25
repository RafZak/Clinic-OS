import {
  BookOpen,
  Database,
  LayoutDashboard,
  Notebook,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./role";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  match?: "exact" | "prefix";
};

export const PRIMARY_NAV: NavItem[] = [
  {
    href: "/",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    roles: ["audioprothesiste", "assistant"],
    match: "exact",
  },
  {
    href: "/patients",
    label: "Patients",
    icon: Users,
    roles: ["audioprothesiste", "assistant"],
  },
  {
    href: "/catalogue",
    label: "Catalogue",
    icon: BookOpen,
    roles: ["audioprothesiste", "assistant"],
  },
];

export const ADMIN_NAV: NavItem[] = [
  {
    href: "/admin/knowledge",
    label: "Base formation",
    icon: Database,
    roles: ["audioprothesiste", "assistant"],
  },
  {
    href: "/admin/vault",
    label: "Mémoire",
    icon: Notebook,
    roles: ["audioprothesiste", "assistant"],
  },
];

export function filterNavByRole(items: NavItem[], role: Role): NavItem[] {
  return items.filter((item) => item.roles.includes(role));
}
