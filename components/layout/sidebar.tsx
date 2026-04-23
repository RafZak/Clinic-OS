import Link from "next/link";
import {
  ADMIN_NAV,
  PRIMARY_NAV,
  filterNavByRole,
} from "@/lib/nav-config";
import type { Role } from "@/lib/role";
import { NavLink } from "./nav-link";

export function Sidebar({ role }: { role: Role }) {
  const primary = filterNavByRole(PRIMARY_NAV, role);
  const admin = filterNavByRole(ADMIN_NAV, role);

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-surface px-3 py-4">
      <Link href="/" className="flex items-center gap-2 px-3 py-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand">
          <span className="size-2 rounded-full bg-white" />
        </span>
        <span className="text-sm font-semibold tracking-tight">Clinic OS</span>
      </Link>

      <nav className="mt-6 flex flex-1 flex-col gap-0.5">
        {primary.map(({ icon: Icon, ...item }) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            match={item.match}
            icon={<Icon className="size-4" />}
          />
        ))}
      </nav>

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
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
