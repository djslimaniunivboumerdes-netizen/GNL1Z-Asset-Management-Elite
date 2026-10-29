import { lazy, Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const AiAgentChat = lazy(() => import("@/components/AiAgentChat").then((module) => ({ default: module.AiAgentChat })));

export default function AppLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [pathname]);

  return (
    <SidebarProvider>
      <a href="#main-content" className="sr-only z-[100] rounded-md bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 pb-20 outline-none md:pb-0">
            <ErrorBoundary key={pathname}><Outlet /></ErrorBoundary>
          </main>
          <Suspense fallback={null}><AiAgentChat /></Suspense>
        </div>
      </div>
    </SidebarProvider>
  );
}
