
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "@/hooks/useAuth";
import { ContactSheetProvider } from "@/components/spheresync/ContactSheetProvider";
import { ConversationStarterProvider } from "@/components/comm/ConversationStarterProvider";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { RouteGuard } from "@/components/layout/RouteGuard";
import Auth from "./pages/Auth";
// OAuthCallback removed — was Postiz-era social-oauth handler. Metricool's
// social network connections happen inside Metricool's own UI (or via the
// admin), so REOP doesn't need an OAuth callback for the social hub.
import Index from "./pages/Index";
import ResetPassword from "./pages/ResetPassword";
import SphereSyncTasks from "./pages/SphereSyncTasks";
import Database from "./pages/Database";
import Pipeline from "./pages/Pipeline";
import Events from "./pages/Events";
import NotFound from "./pages/NotFound";
import Newsletter from "./pages/Newsletter";
import Coaching from "./pages/Coaching";
import Transactions from "./pages/Transactions";
import AdminTeamManagement from "./pages/AdminTeamManagement";
import AdminEventsManagement from "./pages/AdminEventsManagement";
import AdminDashboard from "./pages/AdminDashboard";
import AdminNewsletter from "./pages/AdminNewsletter";
import AdminDatabaseManagement from "./pages/AdminDatabaseManagement";
import AdminEmailLogs from "./pages/AdminEmailLogs";
import AdminCoachingManagement from "./pages/AdminCoachingManagement";
import SocialScheduler from "./pages/SocialScheduler";
import AdminSocialScheduler from "./pages/AdminSocialScheduler";
import AdminSphereSyncRecovery from "./pages/AdminSphereSyncRecovery";
import EventPublicPage from "./pages/EventPublicPage";
import EditorLanding from "./pages/EditorLanding";
import Support from "./pages/Support";
import SupportArticle from "./pages/SupportArticle";
import AdminSupportArticles from "./pages/AdminSupportArticles";
import AdminSponsors from "./pages/AdminSponsors";
import PipelineSurvey from "./pages/PipelineSurvey";
import AdminSurveyResults from "./pages/AdminSurveyResults";
import NewsletterBuilderPage from "./pages/NewsletterBuilder";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import Welcome from "./pages/Welcome";
import Resources from "./pages/Resources";
import AdminResources from "./pages/AdminResources";
import Delight from "./pages/Delight";
import DesignSystem from "./pages/DesignSystem";
import ContactDetail from "./pages/ContactDetail";
import OpportunityDetail from "./pages/OpportunityDetail";
import EventDetail from "./pages/EventDetail";
import Search from "./pages/Search";
import Scoreboard from "./pages/Scoreboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min — reduce unnecessary refetches on tab focus
      retry: (failureCount, error: any) => {
        // Don't retry auth errors
        if (error?.status === 401 || error?.code === 'PGRST301') return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: false, // opt-in per query instead
    },
    mutations: {
      retry: false,
    },
  },
});

const HomeRoute = () => <Index />;

const AppContent = () => {
  return (
    <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/auth" element={<Auth />} />
          <Route path="/auth/reset" element={<ResetPassword />} />
        <Route path="/spheresync-tasks" element={<SphereSyncTasks />} />
        <Route path="/database" element={<Database />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/events" element={<Events />} />
        <Route path="/newsletter" element={<Newsletter />} />
        <Route path="/coaching" element={<Coaching />} />
        <Route
          path="/transactions"
          element={
            <RouteGuard route="/transactions">
              <Transactions />
            </RouteGuard>
          }
        />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/team-management" element={<AdminTeamManagement />} />
        <Route path="/admin/events" element={<AdminEventsManagement />} />
        <Route path="/admin/newsletter" element={<AdminNewsletter />} />
        <Route path="/admin/database" element={<AdminDatabaseManagement />} />
        <Route path="/admin/email-logs" element={<AdminEmailLogs />} />
        <Route path="/admin/coaching" element={<AdminCoachingManagement />} />
        <Route path="/social-scheduler" element={<SocialScheduler />} />
        <Route path="/admin/social-scheduler" element={<AdminSocialScheduler />} />
        <Route path="/admin/spheresync-recovery" element={<AdminSphereSyncRecovery />} />
        {/* /oauth-callback removed with Postiz */}
        <Route path="/event/:slug" element={<EventPublicPage />} />
        <Route path="/internal/editor" element={<EditorLanding />} />
        <Route path="/support" element={<Support />} />
        <Route path="/support/articles/:slug" element={<SupportArticle />} />
        <Route path="/admin/support-articles" element={<AdminSupportArticles />} />
        <Route path="/admin/sponsors" element={<AdminSponsors />} />
        <Route path="/admin/survey-results" element={<AdminSurveyResults />} />
        <Route path="/survey/pipeline" element={<PipelineSurvey />} />
        <Route path="/newsletter-builder/:templateId?" element={<NewsletterBuilderPage />} />
        <Route path="/admin/announcements" element={<AdminAnnouncements />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/delight" element={<Delight />} />
        <Route path="/admin/resources" element={<AdminResources />} />
        <Route path="/design-system" element={<DesignSystem />} />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/pipeline/:id" element={<OpportunityDetail />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/search" element={<Search />} />
        <Route path="/scoreboard" element={<Scoreboard />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            {/* ConversationStarterProvider must be OUTER — ContactSheetProvider
                renders the ContactQuickSheet inline, and the sheet now uses
                useConversationStarter() for its Call/Text/Email buttons. If
                the order is swapped, the sheet is rendered outside the
                conversation-starter tree and the hook throws. */}
            <ConversationStarterProvider>
              <ContactSheetProvider>
                <TooltipProvider>
                  <AppContent />
                  <Toaster />
                  <Sonner />
                </TooltipProvider>
              </ContactSheetProvider>
            </ConversationStarterProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
