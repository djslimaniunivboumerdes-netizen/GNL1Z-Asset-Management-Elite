import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { AiAgentChat } from "@/components/AiAgentChat";

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <AppHeader />
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
          {/* FLOATING AI ASSISTANT OVERLAY */}
          <AiAgentChat />
        </div>
      </div>
    </SidebarProvider>
  );
}
