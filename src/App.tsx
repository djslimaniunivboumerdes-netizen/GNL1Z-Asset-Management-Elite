import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import TestSchedule from "./pages/TestSchedule";
import About from "./pages/About";
import EquipmentList from "./pages/EquipmentList";
import EquipmentDetail from "./pages/EquipmentDetail";
import DcsDirectory from "./pages/DcsDirectory";
import DcsDetail from "./pages/DcsDetail";
import Manuals from "./pages/Manuals";
import ProcessFlow from "./pages/ProcessFlow";
import SmartFlow from "./pages/SmartFlow";
import News from "./pages/News";
import Author from "./pages/Author";
import DownloadPage from "./pages/DownloadPage";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import LogTest from "./pages/LogTest";
import AlertCenter from "./pages/AlertCenter";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/"                   element={<Dashboard />} />
                  <Route path="/about"              element={<About />} />
                  <Route path="/equipment"          element={<EquipmentList />} />
                  <Route path="/equipment/:tag"     element={<EquipmentDetail />} />
                  <Route path="/equipment/:tag/log" element={<LogTest />} />
                  <Route path="/test-schedule" element={<TestSchedule />} />
                  <Route path="/alerts"             element={<AlertCenter />} />
                  <Route path="/dcs"                element={<DcsDirectory />} />
                  <Route path="/dcs/:id"            element={<DcsDetail />} />
                  <Route path="/manuals"            element={<Manuals />} />
                  <Route path="/flow"               element={<ProcessFlow />} />
                  <Route path="/smart-flow"         element={<SmartFlow />} />
                  <Route path="/news"               element={<News />} />
                  <Route path="/author"             element={<Author />} />
                  <Route path="/auth"               element={<Auth />} />
                  {/* OAuth + email-confirmation landing page */}
                  <Route path="/auth/callback"      element={<AuthCallback />} />
                  <Route path="/download"           element={<DownloadPage lang="en" />} />
                  <Route path="*"                   element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
