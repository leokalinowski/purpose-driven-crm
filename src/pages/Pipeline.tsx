import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PipelineMetrics } from "@/components/pipeline/PipelineMetrics";
import { AddOpportunityDialog } from "@/components/pipeline/AddOpportunityDialog";
import { usePipeline } from "@/hooks/usePipeline";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

export default function Pipeline() {
  const { opportunities, metrics, loading, updateStage, createOpportunity, refresh } = usePipeline();

  return (
    <>
      <Helmet>
        <title>Pipeline - Real Estate on Purpose</title>
        <meta name="description" content="Track your deals through the sales pipeline from lead to closing with visual Kanban board and metrics." />
      </Helmet>
      
      <Layout>
        <DndProvider backend={HTML5Backend}>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
                <p className="text-muted-foreground">
                  Track your deals from lead to closing
                </p>
              </div>
              <AddOpportunityDialog onOpportunityCreated={refresh} />
            </div>

            <PipelineMetrics metrics={metrics} loading={loading} />
            
            <PipelineBoard 
              opportunities={opportunities}
              onStageUpdate={updateStage}
              loading={loading}
            />
          </div>
        </DndProvider>
      </Layout>
    </>
  );
}