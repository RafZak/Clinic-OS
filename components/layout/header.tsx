import type { Role } from "@/lib/role";
import type { Locale } from "@/lib/locale";
import { LocaleSwitch } from "./locale-switch";
import { NewSessionButton } from "./new-session-button";
import { RoleToggle } from "./role-toggle";
import { SearchTrigger } from "./search-trigger";

export function Header({ role, locale }: { role: Role; locale: Locale }) {
  return (
    <header className="sticky top-0 z-20 flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6">
      <div className="flex items-center gap-3">
        <RoleToggle current={role} />
        <LocaleSwitch current={locale} />
      </div>
      <div className="mx-auto flex-1 max-w-xl">
        <SearchTrigger />
      </div>
      <div className="flex items-center gap-2">
        <NewSessionButton role={role} />
      </div>
    </header>
  );
}
