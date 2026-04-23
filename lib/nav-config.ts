import {
  BookOpen,
  ClipboardCheck,
  Database,
  LayoutDashboard,
  Notebook,
  Phone,
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
    href: "/consultations",
    label: "Consultations",
    icon: ClipboardCheck,
    roles: ["audioprothesiste"],
  },
  {
    href: "/appels",
    label: "Appels entrants",
    icon: Phone,
    roles: ["assistant"],
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
    label: "Admin Knowledge",
    icon: Database,
    roles: ["audioprothesiste", "assistant"],
  },
  {
    href: "/admin/vault",
    label: "Admin Vault",
    icon: Notebook,
    roles: ["audioprothesiste", "assistant"],
  },
];

export function filterNavByRole(items: NavItem[], role: Role): NavItem[] {
  return items.filter((item) => item.roles.includes(role));
}
