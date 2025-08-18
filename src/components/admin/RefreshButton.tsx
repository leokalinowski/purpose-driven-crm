import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';
import { useState } from 'react';

export function RefreshButton() {
  const { refetch } = useAdminMetrics();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500); // Ensure visible feedback
  };

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handleRefresh}
      disabled={isRefreshing}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
      Refresh Data
    </Button>
  );
}