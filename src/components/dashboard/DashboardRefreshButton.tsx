import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useState } from 'react';

export function DashboardRefreshButton() {
  const { refreshData, lastFetch } = useDashboardData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    // Ensure visible feedback for at least 500ms
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const formatLastFetch = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins === 0) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
      <span className="text-xs text-muted-foreground">
        Last updated: {formatLastFetch(lastFetch)}
      </span>
    </div>
  );
}