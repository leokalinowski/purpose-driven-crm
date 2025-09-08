
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SphereSyncTasks from "./pages/SphereSyncTasks";
import Database from "./pages/Database";
import Events from "./pages/Events";
import NotFound from "./pages/NotFound";
import Newsletter from "./pages/Newsletter";
import Coaching from "./pages/Coaching";
import Transactions from "./pages/Transactions";
import Pipeline from "./pages/Pipeline";
import AdminInvitations from "./pages/AdminInvitations";
import AdminDashboard from "./pages/AdminDashboard";
import AdminNewsletter from "./pages/AdminNewsletter";
import SocialScheduler from "./pages/SocialScheduler";
import AdminSocialScheduler from "./pages/AdminSocialScheduler";
import OAuthCallback from "./pages/OAuthCallback";

const queryClient = new QueryClient();

const AppContent = () => (
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
);

function App() {
  return (
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
  );
}

export default App;
