import { getRole } from "@/lib/role";
import { getLocale } from "@/lib/locale";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { Breadcrumbs } from "./breadcrumbs";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  const locale = await getLocale();

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header role={role} locale={locale} />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-8 pb-8 pt-5">
          <Breadcrumbs />
          <div className="mt-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
