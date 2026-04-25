import Link from "next/link";
import {
  ADMIN_NAV,
  PRIMARY_NAV,
  filterNavByRole,
  type NavItem,
} from "@/lib/nav-config";
import type { Role } from "@/lib/role";
import { loadSidebarContext } from "@/lib/sidebar-context";
import { NavLink } from "./nav-link";
import { SidebarRecents } from "./sidebar-recents";
import { SidebarFooter } from "./sidebar-footer";

type Badge = {
  count: number;
  tone: "alert" | "info";
  tooltip: string;
} | null;

function badgeFor(item: NavItem, ctx: {
  patientsAlerts: number;
  vaultUpdatesToday: number;
}): Badge {
  if (item.href === "/patients" && ctx.patientsAlerts > 0) {
    const n = ctx.patientsAlerts;
    return {
      count: n,
      tone: "alert",
      tooltip: `${n} patient${n > 1 ? "s" : ""} perdu${n > 1 ? "s" : ""} — à rappeler`,
    };
  }
  if (item.href === "/admin/vault" && ctx.vaultUpdatesToday > 0) {
    const n = ctx.vaultUpdatesToday;
    return {
      count: n,
      tone: "info",
      tooltip: `${n} fiche${n > 1 ? "s" : ""} Karpathy mise${n > 1 ? "s" : ""} à jour aujourd'hui`,
    };
  }
  return null;
}

export async function Sidebar({ role }: { role: Role }) {
  const primary = filterNavByRole(PRIMARY_NAV, role);
  const admin = filterNavByRole(ADMIN_NAV, role);
  const ctx = await loadSidebarContext();

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-3 py-4">
      <Link href="/" className="flex items-center gap-2 px-3 py-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand">
          <span className="size-2 rounded-full bg-white" />
        </span>
        <span className="text-sm font-semibold tracking-tight">Clinic OS</span>
      </Link>

      <nav className="mt-6 flex flex-col gap-0.5">
        {primary.map(({ icon: Icon, ...item }) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            match={item.match}
            icon={<Icon className="size-4" />}
            badge={badgeFor(item as NavItem, ctx)}
          />
        ))}
      </nav>

      <SidebarRecents
        patients={ctx.recentPatients}
        lastSession={ctx.lastSession}
      />

      <div className="flex-1" />

      {admin.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Admin
          </p>
          <div className="flex flex-col gap-0.5">
            {admin.map(({ icon: Icon, ...item }) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                match={item.match}
                icon={<Icon className="size-4" />}
                badge={badgeFor(item as NavItem, ctx)}
              />
            ))}
          </div>
        </div>
      )}

      <SidebarFooter />
    </aside>
  );
}
