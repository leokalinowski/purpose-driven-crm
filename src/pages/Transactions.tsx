import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { TransactionMetrics } from "@/components/transactions/TransactionMetrics";
import { EnhancedTransactionMetrics } from "@/components/transactions/EnhancedTransactionMetrics";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionCharts } from "@/components/transactions/TransactionCharts";
import { SyncButton } from "@/components/transactions/SyncButton";
import { useTransactions } from "@/hooks/useTransactions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Transactions() {
  const { transactions, metrics, loading, syncWithOpenToClose } = useTransactions();

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
              <h1 className="text-3xl font-bold tracking-tight">Transaction Coordination</h1>
              <p className="text-muted-foreground">
                Track your deals, monitor performance, and sync with OpenToClose
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