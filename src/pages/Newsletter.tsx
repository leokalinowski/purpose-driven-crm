import React from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { TemplateList } from "@/components/newsletter/builder/TemplateList";
import { NewsletterAnalyticsDashboard } from "@/components/newsletter/analytics/NewsletterAnalyticsDashboard";
import { NewsletterScheduleSettings } from "@/components/newsletter/NewsletterScheduleSettings";
import { NewsletterTaskCard } from "@/components/newsletter/NewsletterTaskCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Newsletter() {
  return (
    <Layout>
      <Helmet>
        <title>Newsletter Dashboard</title>
        <meta name="description" content="Newsletter analytics and template builder." />
        <link rel="canonical" href={`${window.location.origin}/newsletter`} />
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.09em] text-primary">E-Newsletter</span>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Stay top of mind at scale.</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Build templates and track campaign performance.
            </p>
          </div>
          <NewsletterScheduleSettings />
        </div>

        <NewsletterTaskCard />

        <Tabs defaultValue="builder" className="w-full">
          <TabsList>
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="mt-4">
            <TemplateList />
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <NewsletterAnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
