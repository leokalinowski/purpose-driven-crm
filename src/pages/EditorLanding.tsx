import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';

import { AgentSelector } from '@/components/admin/AgentSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function EditorLanding() {
  const { toast } = useToast();
  const [selectedAgentUserId, setSelectedAgentUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentUserId) {
      toast({ title: 'Select an agent', description: 'Please choose an agent before submitting.' });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('make-agent-webhook', {
        body: { agentUserId: selectedAgentUserId },
      });

      if (error) throw error;

      toast({
        title: 'Submitted to Make',
        description: data?.success ? 'Your request was sent successfully.' : 'Request sent (check Make scenario logs).',
      });
      setSelectedAgentUserId(null);
    } catch (err: any) {
      console.error('Make submit failed:', err);
      toast({
        title: 'Submission failed',
        description: err?.message || 'Unable to submit. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Editor Intake</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Video Editor Intake</CardTitle>
            <CardDescription>Select an agent and submit to trigger the Make scenario.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Agent</div>
                <AgentSelector
                  selectedAgentId={selectedAgentUserId}
                  onAgentSelect={setSelectedAgentUserId}
                  includeAllOption={false}
                  canManageAgents={true}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting || !selectedAgentUserId}>
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}