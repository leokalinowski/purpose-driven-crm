import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { TransactionMetrics } from "@/components/transactions/TransactionMetrics";
import { EnhancedTransactionMetrics } from "@/components/transactions/EnhancedTransactionMetrics";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionCharts } from "@/components/transactions/TransactionCharts";
import { SyncButton } from "@/components/transactions/SyncButton";
import { useTransactions } from "@/hooks/useTransactions";
import { UpgradePrompt } from "@/components/ui/UpgradePrompt";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Transactions() {
  const { hasAccess, currentTier, getRequiredTier } = useFeatureAccess();
  const { transactions, metrics, loading, syncWithOpenToClose } = useTransactions();

  if (!hasAccess('/transactions')) {
    return (
      <Layout>
        <UpgradePrompt
          featureName="Transaction Coordination"
          requiredTier={getRequiredTier('/transactions') || 'managed'}
          currentTier={currentTier}
          description="Track your deals, monitor performance, and sync with OpenToClose. Available on the Managed plan and above."
        />
      </Layout>
    );
  }

  return (
    <>
      <Helmet>
        <title>Transaction Coordination - Real Estate on Purpose</title>
        <meta name="description" content="Track and manage your real estate transactions with comprehensive metrics and OpenToClose integration." />
      </Helmet>
      
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.09em] text-primary">Transactions</span>
              <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Track every deal to close.</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Monitor performance and sync with OpenToClose.
              </p>
            </div>
            <SyncButton onSync={syncWithOpenToClose} loading={loading} />
          </div>

          <Tabs defaultValue="enhanced" className="space-y-6">
            <TabsList>
              <TabsTrigger value="enhanced">Enhanced Analytics</TabsTrigger>
              <TabsTrigger value="basic">Basic Metrics</TabsTrigger>
            </TabsList>
            
            <TabsContent value="enhanced" className="space-y-6">
              <EnhancedTransactionMetrics metrics={metrics} loading={loading} />
              <TransactionCharts transactions={transactions} loading={loading} />
              <TransactionTable transactions={transactions} loading={loading} />
            </TabsContent>
            
            <TabsContent value="basic" className="space-y-6">
              <TransactionMetrics metrics={metrics} loading={loading} />
              <TransactionCharts transactions={transactions} loading={loading} />
              <TransactionTable transactions={transactions} loading={loading} />
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </>
  );
}