import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface SyncButtonProps {
  onSync: () => Promise<void>;
  loading: boolean;
}

export function SyncButton({ onSync, loading }: SyncButtonProps) {
  return (
    <Button 
      onClick={onSync} 
      disabled={loading}
      className="flex items-center gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Syncing...' : 'Sync with OpenToClose'}
    </Button>
  );
}