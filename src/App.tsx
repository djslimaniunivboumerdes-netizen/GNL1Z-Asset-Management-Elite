import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { RouteFallback } from "@/components/RouteFallback";
import Dashboard from "./pages/Dashboard";

// Keep heavy diagrams, editors and authentication off the initial dashboard path.
const TestSchedule = lazy(() => import("./pages/TestSchedule"));
const About = lazy(() => import("./pages/About"));
const EquipmentList = lazy(() => import("./pages/EquipmentList"));
const EquipmentDetail = lazy(() => import("./pages/EquipmentDetail"));
const DcsDirectory = lazy(() => import("./pages/DcsDirectory"));
const DcsDetail = lazy(() => import("./pages/DcsDetail"));
const Manuals = lazy(() => import("./pages/Manuals"));
const SmartFlow = lazy(() => import("./pages/SmartFlow"));
const News = lazy(() => import("./pages/News"));
const Author = lazy(() => import("./pages/Author"));
const DownloadPage = lazy(() => import("./pages/DownloadPage"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const LogTest = lazy(() => import("./pages/LogTest"));
const AlertCenter = lazy(() => import("./pages/AlertCenter"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/equipment" element={<EquipmentList />} />
                    <Route path="/equipment/:tag" element={<EquipmentDetail />} />
                    <Route path="/equipment/:tag/log" element={<LogTest />} />
                    <Route path="/test-schedule" element={<TestSchedule />} />
                    <Route path="/alerts" element={<AlertCenter />} />
                    <Route path="/dcs" element={<DcsDirectory />} />
                    <Route path="/dcs/:id" element={<DcsDetail />} />
                    <Route path="/manuals" element={<Manuals />} />
                    <Route path="/flow" element={<SmartFlow />} />
                    <Route path="/smart-flow" element={<SmartFlow />} />
                    <Route path="/news" element={<News />} />
                    <Route path="/author" element={<Author />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/download" element={<DownloadPage lang="en" />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
