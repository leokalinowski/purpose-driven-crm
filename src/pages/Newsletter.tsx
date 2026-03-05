import React from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { TemplateList } from "@/components/newsletter/builder/TemplateList";
import { NewsletterAnalyticsDashboard } from "@/components/newsletter/analytics/NewsletterAnalyticsDashboard";
import { NewsletterScheduleSettings } from "@/components/newsletter/NewsletterScheduleSettings";
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">E-Newsletter</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Build templates and track campaign performance
            </p>
          </div>
          <NewsletterScheduleSettings />
        </div>

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
