import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import { AgentSelector } from '@/components/admin/AgentSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';

export default function EditorLanding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isEditor, loading: roleLoading, error: roleError, refetch: refetchRole } = useUserRole();

  const [selectedAgentUserId, setSelectedAgentUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canAccess = isAdmin || isEditor;

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent('/internal/editor')}`, { replace: true });
      return;
    }
    // NOTE: Do not redirect on role verification errors; show retry UI instead.
  }, [authLoading, roleLoading, user, canAccess, navigate]);

  const submitDisabled = useMemo(() => submitting || !selectedAgentUserId || !canAccess, [submitting, selectedAgentUserId, canAccess]);

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

  if (authLoading || roleLoading) {
    return (
      <>
        <Helmet>
          <title>Editor Intake</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <main className="min-h-screen flex items-center justify-center p-6">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>Verifying access…</CardTitle>
              <CardDescription>Please wait.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-10 w-64 bg-muted animate-pulse rounded-md" />
                <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
              </div>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  if (user && roleError) {
    return (
      <>
        <Helmet>
          <title>Editor Intake</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <main className="min-h-screen flex items-center justify-center p-6">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>Unable to verify permissions</CardTitle>
              <CardDescription>
                Please retry. If this persists, open the browser console and share the error.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground break-words">
                {(roleError as any)?.message ? (roleError as any).message : 'Role lookup failed.'}
              </div>
              <Button type="button" onClick={refetchRole} className="w-full">
                Retry
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  if (user && !canAccess) {
    return (
      <>
        <Helmet>
          <title>Editor Intake</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <main className="min-h-screen flex items-center justify-center p-6">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>Not authorized</CardTitle>
              <CardDescription>This page is limited to admins and editors.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/', { replace: true })}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

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
                  canManageAgents={canAccess}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitDisabled}>
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
