import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { PipelineCanvas } from '@/components/pipeline/PipelineCanvas';
import { useAuth } from '@/hooks/useAuth';

export default function Pipeline() {
  // Auth gate — matches the pattern in Database.tsx / SphereSyncTasks.tsx.
  // Without this, an unauthenticated visitor reaches the page and `usePipeline`
  // bails on the fetch, leaving the board in skeleton state with no signal to
  // sign in. Wait for auth to resolve before deciding which fallback to render
  // (otherwise hard-refresh briefly flashes "Please sign in" while `user` is
  // null and `useAuth().loading` is still true).
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <>
        <Helmet><title>Pipeline — Real Estate on Purpose</title></Helmet>
        <Layout>
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
            Loading pipeline…
          </div>
        </Layout>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Helmet><title>Pipeline — Real Estate on Purpose</title></Helmet>
        <Layout>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm">Please sign in to view your pipeline.</p>
          </div>
        </Layout>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Pipeline — Real Estate on Purpose</title></Helmet>
      <Layout>
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-start md:justify-between gap-4 mb-6 md:mb-7">
          <div>
            <span className="eye-label block mb-1.5">Pipeline</span>
            <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-medium tracking-tighter leading-[1.15] mb-1.5">
              Every opportunity, every stage.
            </h1>
            {/* Phase 3: drag works everywhere now (desktop HTML5 + mobile
                touch via react-dnd-multi-backend). The per-card ⋯ menu is
                still available as an alternative path. */}
            <p className="text-sm text-muted-foreground max-w-[640px] leading-[1.55]">
              Drag cards between stages to move opportunities forward. The Coach surfaces stale opportunities and AI scores fresh probabilities as you log activity.
            </p>
          </div>
        </div>

        <PipelineCanvas variant="standalone" />
      </Layout>
    </>
  );
}
