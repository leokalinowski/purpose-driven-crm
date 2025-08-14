
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PO2Tasks from "./pages/PO2Tasks";
import Database from "./pages/Database";
import Events from "./pages/Events";
import NotFound from "./pages/NotFound";
import Newsletter from "./pages/Newsletter";
import Coaching from "./pages/Coaching";

const queryClient = new QueryClient();

const AppContent = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/po2-tasks" element={<PO2Tasks />} />
    <Route path="/database" element={<Database />} />
    <Route path="/events" element={<Events />} />
    <Route path="/newsletter" element={<Newsletter />} />
    <Route path="/coaching" element={<Coaching />} />
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
