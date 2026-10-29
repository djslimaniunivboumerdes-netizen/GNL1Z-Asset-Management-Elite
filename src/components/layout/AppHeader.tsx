import { Link } from "react-router-dom";
import { Moon, Sun, Languages, LogIn, LogOut, Settings, UserCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { META } from "@/data";
import { useNavigate } from "react-router-dom";
import { GlobalSearch } from "@/components/GlobalSearch";
import { QrScannerButton } from "@/components/QrScannerButton";
import { OnlineStatus } from "@/components/OnlineStatus";
import sonatrachLogo from "@/assets/sonatrach-logo.png";
import type { User } from "@supabase/supabase-js";

const AVATAR_COLORS = [
  "bg-cyan-600",   "bg-indigo-600", "bg-emerald-600",
  "bg-amber-500", "bg-rose-600",   "bg-teal-600",
];

function emailColor(email: string): string {
  let h = 0;
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Avatar({ user }: { user: User }) {
  const pic: string | undefined =
    (user.user_metadata?.avatar_url as string | undefined) ||
    (user.user_metadata?.picture   as string | undefined);

  const displayName: string =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name      as string | undefined) ||
    user.email || "?";

  const initials = displayName.trim().charAt(0).toUpperCase();
  const color    = emailColor(user.email ?? displayName);

  if (pic) {
    return (
      <img
        src={pic}
        alt={displayName}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover rounded-full"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
          (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute("hidden");
        }}
      />
    );
  }

  return (
    <span
      className={`flex h-full w-full items-center justify-center rounded-full ${color} text-white text-sm font-bold leading-none select-none`}
    >
      {initials}
    </span>
  );
}

function UserMenu({ user }: { user: User }) {
  const { signOut } = useAuth();
  const { t }       = useI18n();
  const navigate    = useNavigate();

  const displayName: string =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name      as string | undefined) ||
    user.email?.split("@")[0] || "User";

  const isGoogle =
    (user.app_metadata?.provider as string | undefined) === "google" ||
    !!(user.user_metadata?.avatar_url || user.user_metadata?.picture);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="User menu"
          className={[
            "relative h-9 w-9 rounded-full overflow-hidden",
            "ring-2 ring-cyan-500/40 hover:ring-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]",
            "focus:outline-none focus-visible:ring-cyan-400",
            "transition-all duration-200 cursor-pointer",
          ].join(" ")}
        >
          <Avatar user={user} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 bg-popover border border-border text-popover-foreground shadow-2xl rounded-2xl p-2">
        <DropdownMenuLabel className="font-normal pb-3 pt-2 px-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-slate-700 shrink-0">
              <Avatar user={user} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate text-foreground tracking-tight">{displayName}</p>
              <p className="text-[11px] text-muted-foreground font-mono truncate">{user.email}</p>
              {isGoogle && (
                <span className="inline-flex items-center gap-1.5 text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full mt-1.5 font-mono">
                  <Zap className="h-2.5 w-2.5" /> Google OAuth
                </span>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-border my-1" />

        <DropdownMenuItem
          className="cursor-pointer gap-2.5 text-sm py-2.5 px-3 hover:bg-accent/10 rounded-xl transition-colors text-foreground hover:text-foreground"
          onClick={() => navigate("/author")}
        >
          <UserCircle2 className="h-4 w-4 text-cyan-400" />
          {t("operatorProfile")}
        </DropdownMenuItem>

        <DropdownMenuItem
          className="cursor-pointer gap-2.5 text-sm py-2.5 px-3 hover:bg-accent/10 rounded-xl transition-colors text-foreground hover:text-foreground"
          onClick={() => navigate("/download")}
        >
          <Settings className="h-4 w-4 text-amber-400" />
          {t("appDownloads")}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-border my-1" />

        <DropdownMenuItem
          className="cursor-pointer gap-2.5 text-sm py-2.5 px-3 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-colors focus:text-rose-300 focus:bg-rose-500/30"
          onClick={() => { void signOut().catch(() => navigate("/auth")); }}
        >
          <LogOut className="h-4 w-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader() {
  const { theme, toggle } = useTheme();
  const { lang, toggle: toggleLang, t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-1.5 border-b border-border bg-background/95 px-3 backdrop-blur-xl sm:gap-2 md:px-6">
      <SidebarTrigger className="h-9 w-9 shrink-0" />
      <Link to="/" className="mr-auto flex shrink-0 items-center gap-2 rounded-md" aria-label="GNL1Z dashboard">
        <img src={sonatrachLogo} alt="Sonatrach" className="h-8 w-8 object-contain" />
        <span className="hidden text-xs font-semibold tracking-wide min-[420px]:inline xl:hidden">GNL1Z</span>
      </Link>
      <div className="mr-auto hidden min-w-0 items-center gap-3 xl:flex">
        <span className="text-xs font-semibold tracking-wide">{META.project}</span><span className="h-4 w-px bg-border" />
        <span className="truncate text-xs text-muted-foreground">{META.location}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <OnlineStatus />
        <GlobalSearch />
        <div className="hidden sm:block"><QrScannerButton onScan={(id) => navigate(`/equipment/${encodeURIComponent(id)}`)} /></div>
        <Button variant="ghost" size="sm" onClick={toggleLang} aria-label={lang === "en" ? "Passer en français" : "Switch to English"} className="h-9 w-9 gap-1 rounded-lg px-0 text-xs font-medium">{lang.toUpperCase()}</Button>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} className="h-9 w-9 rounded-lg">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
        {user ? <UserMenu user={user} /> : <Button size="sm" onClick={() => navigate("/auth")} aria-label={t("signIn")} className="h-9 gap-2 rounded-lg bg-cyan-700 px-2.5 text-white hover:bg-cyan-600"><LogIn className="h-4 w-4" /><span className="hidden md:inline">{t("signIn")}</span></Button>}
      </div>
    </header>
  );
}
