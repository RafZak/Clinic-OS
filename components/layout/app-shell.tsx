import { getRole } from "@/lib/role";
import { getLocale } from "@/lib/locale";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  const locale = await getLocale();

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header role={role} locale={locale} />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
