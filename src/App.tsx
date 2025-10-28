
import React, { Suspense, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import Auth from "./pages/Auth";
import OAuthCallback from "./pages/OAuthCallback";

// Lazy load pages for code splitting
const Index = React.lazy(() => import("./pages/Index"));
const SphereSyncTasks = React.lazy(() => import("./pages/SphereSyncTasks"));
const Database = React.lazy(() => import("./pages/Database"));
const Events = React.lazy(() => import("./pages/Events"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Newsletter = React.lazy(() => import("./pages/Newsletter"));
const Coaching = React.lazy(() => import("./pages/Coaching"));
const Transactions = React.lazy(() => import("./pages/Transactions"));
const Pipeline = React.lazy(() => import("./pages/Pipeline"));
const AdminInvitations = React.lazy(() => import("./pages/AdminInvitations"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const AdminNewsletter = React.lazy(() => import("./pages/AdminNewsletter"));
const SocialScheduler = React.lazy(() => import("./pages/SocialScheduler"));
const AdminSocialScheduler = React.lazy(() => import("./pages/AdminSocialScheduler"));

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <h1 className="text-2xl font-semibold">Loading...</h1>
    </div>
  </div>
);

const queryClient = new QueryClient();

const AppContent = () => {
  useEffect(() => {
    console.log('✅ AppContent mounted, router active');
  }, []);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/spheresync-tasks" element={<SphereSyncTasks />} />
        <Route path="/database" element={<Database />} />
        <Route path="/events" element={<Events />} />
        <Route path="/newsletter" element={<Newsletter />} />
        <Route path="/coaching" element={<Coaching />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/invitations" element={<AdminInvitations />} />
        <Route path="/admin/newsletter" element={<AdminNewsletter />} />
        <Route path="/social-scheduler" element={<SocialScheduler />} />
        <Route path="/admin/social-scheduler" element={<AdminSocialScheduler />} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider>
              <AppContent />
              <Toaster />
              <Sonner />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
