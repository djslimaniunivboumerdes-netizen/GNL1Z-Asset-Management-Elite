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

      <DropdownMenuContent align="end" className="w-64 bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl rounded-2xl p-2">
        <DropdownMenuLabel className="font-normal pb-3 pt-2 px-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-slate-700 shrink-0">
              <Avatar user={user} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate text-white tracking-tight">{displayName}</p>
              <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
              {isGoogle && (
                <span className="inline-flex items-center gap-1.5 text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full mt-1.5 font-mono">
                  <Zap className="h-2.5 w-2.5" /> Google OAuth
                </span>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-slate-800 my-1" />

        <DropdownMenuItem
          className="cursor-pointer gap-2.5 text-sm py-2.5 px-3 hover:bg-slate-800/80 rounded-xl transition-colors text-slate-300 hover:text-white"
          onClick={() => navigate("/author")}
        >
          <UserCircle2 className="h-4 w-4 text-cyan-400" />
          {t("operatorProfile")}
        </DropdownMenuItem>

        <DropdownMenuItem
          className="cursor-pointer gap-2.5 text-sm py-2.5 px-3 hover:bg-slate-800/80 rounded-xl transition-colors text-slate-300 hover:text-white"
          onClick={() => navigate("/download")}
        >
          <Settings className="h-4 w-4 text-amber-400" />
          {t("appDownloads")}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-800 my-1" />

        <DropdownMenuItem
          className="cursor-pointer gap-2.5 text-sm py-2.5 px-3 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-colors focus:text-rose-300 focus:bg-rose-500/30"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader() {
  const { theme, toggle }            = useTheme();
  const { lang, toggle: toggleLang, t } = useI18n();
  const { user }                     = useAuth();
  const navigate                     = useNavigate();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30 flex items-center px-4 md:px-8 gap-4 shadow-lg">
      <SidebarTrigger className="text-slate-400 hover:text-cyan-400 transition-colors" />

      <img src={sonatrachLogo} alt="Sonatrach" className="h-9 w-auto md:hidden" />

      <div className="hidden md:flex items-center gap-4 min-w-0">
        <img src={sonatrachLogo} alt="Sonatrach" className="h-10 w-auto filter drop-shadow-md" />
        <div className="h-7 w-px bg-slate-800" />
        <span className="text-xs uppercase tracking-widest text-cyan-400 font-mono font-bold">{META.project}</span>
        <span className="text-slate-700">·</span>
        <span className="text-xs text-slate-300 truncate font-light tracking-wide">{META.location}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <OnlineStatus />
        <Badge variant="outline" className="hidden sm:inline-flex border-cyan-500/30 text-cyan-400 bg-cyan-500/10 font-mono text-[10px] px-2.5 py-1 rounded-full shadow-inner">
          {META.process}
        </Badge>
        <QrScannerButton onScan={(id) => navigate(`/equipment/${id}`)} />
        <Button variant="ghost" size="sm" onClick={toggleLang} className="font-mono text-xs gap-1.5 text-slate-300 hover:text-cyan-400 hover:bg-slate-900 rounded-xl px-3 py-2 transition-all">
          <Languages className="h-4 w-4 text-cyan-500" />
          {lang.toUpperCase()}
        </Button>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="text-slate-400 hover:text-amber-400 hover:bg-slate-900 rounded-xl transition-all">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {user ? (
          <UserMenu user={user} />
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate("/auth")}
            className="gap-2 font-mono text-xs bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 rounded-xl px-4 py-2 transition-all"
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline font-bold">{t("signIn")}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
