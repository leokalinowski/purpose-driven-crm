import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useState } from 'react';

export function RefreshButton() {
  console.warn('RefreshButton is deprecated. Use DashboardRefreshButton instead.');
  
  const { refreshData } = useDashboardData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
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