
import React, { Suspense } from 'react';
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

// ─── Eagerly loaded routes ───────────────────────────────────────────────────
// Pages that are part of the first-paint critical path for the typical agent
// flow. Lazy-loading these would just trade one network round-trip for another
// since they're loaded on the user's first visit anyway.
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import SphereSyncTasks from "./pages/SphereSyncTasks";
import Database from "./pages/Database";
import Pipeline from "./pages/Pipeline";
import NotFound from "./pages/NotFound";

// ─── Lazy-loaded routes ──────────────────────────────────────────────────────
// Everything else. Each becomes its own chunk, fetched on first navigation.
// Bundle size before this split: index-DAhLmizF.js = 3.05 MB / 810 KB gzip.
// Routing pulled the entire app into the first chunk via the eager imports.
// Goal of the split: keep the agent's "open app → see dashboard" path lean,
// defer the admin surface, the newsletter builder, and detail pages until
// they're actually visited.
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const Events = React.lazy(() => import("./pages/Events"));
const Newsletter = React.lazy(() => import("./pages/Newsletter"));
const Coaching = React.lazy(() => import("./pages/Coaching"));
const Transactions = React.lazy(() => import("./pages/Transactions"));
const AdminTeamManagement = React.lazy(() => import("./pages/AdminTeamManagement"));
const AdminEventsManagement = React.lazy(() => import("./pages/AdminEventsManagement"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const AdminNewsletter = React.lazy(() => import("./pages/AdminNewsletter"));
const AdminDatabaseManagement = React.lazy(() => import("./pages/AdminDatabaseManagement"));
const AdminEmailLogs = React.lazy(() => import("./pages/AdminEmailLogs"));
const AdminCoachingManagement = React.lazy(() => import("./pages/AdminCoachingManagement"));
const SocialScheduler = React.lazy(() => import("./pages/SocialScheduler"));
const AdminSocialScheduler = React.lazy(() => import("./pages/AdminSocialScheduler"));
const AdminSphereSyncRecovery = React.lazy(() => import("./pages/AdminSphereSyncRecovery"));
const EventPublicPage = React.lazy(() => import("./pages/EventPublicPage"));
const EditorLanding = React.lazy(() => import("./pages/EditorLanding"));
const Support = React.lazy(() => import("./pages/Support"));
const SupportArticle = React.lazy(() => import("./pages/SupportArticle"));
const AdminSupportArticles = React.lazy(() => import("./pages/AdminSupportArticles"));
const AdminSponsors = React.lazy(() => import("./pages/AdminSponsors"));
const PipelineSurvey = React.lazy(() => import("./pages/PipelineSurvey"));
const AdminSurveyResults = React.lazy(() => import("./pages/AdminSurveyResults"));
const NewsletterBuilderPage = React.lazy(() => import("./pages/NewsletterBuilder"));
const AdminAnnouncements = React.lazy(() => import("./pages/AdminAnnouncements"));
const Settings = React.lazy(() => import("./pages/Settings"));
const Pricing = React.lazy(() => import("./pages/Pricing"));
const Welcome = React.lazy(() => import("./pages/Welcome"));
const Resources = React.lazy(() => import("./pages/Resources"));
const AdminResources = React.lazy(() => import("./pages/AdminResources"));
const Delight = React.lazy(() => import("./pages/Delight"));
const DesignSystem = React.lazy(() => import("./pages/DesignSystem"));
const ContactDetail = React.lazy(() => import("./pages/ContactDetail"));
const OpportunityDetail = React.lazy(() => import("./pages/OpportunityDetail"));
const EventDetail = React.lazy(() => import("./pages/EventDetail"));
const Search = React.lazy(() => import("./pages/Search"));
const Scoreboard = React.lazy(() => import("./pages/Scoreboard"));

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

/**
 * Lightweight fallback shown while a lazy chunk loads. Matches the brand
 * dark-blue background of the agent shell so the transition isn't a white
 * flash. Real-world chunk loads finish in <300ms on a warm cache; first-time
 * loads on a cold cache see this for ~1-2s.
 */
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-label="Loading" />
  </div>
);

const AppContent = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
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
