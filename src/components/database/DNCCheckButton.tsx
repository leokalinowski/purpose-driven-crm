import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Shield } from 'lucide-react';
import { useDNCStats } from '@/hooks/useDNCStats';
import { useToast } from '@/components/ui/use-toast';

interface DNCCheckButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
  forceRecheck?: boolean;
}

export const DNCCheckButton: React.FC<DNCCheckButtonProps> = ({ 
  variant = 'outline',
  size = 'default',
  forceRecheck = false
}) => {
  const { triggerDNCCheck, checking } = useDNCStats();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);

  const handleDNCCheck = async () => {
    if (checking || isRunning) return;

    setIsRunning(true);
    try {
      await triggerDNCCheck(forceRecheck);
      toast({
        title: "DNC Check Started",
        description: forceRecheck 
          ? "DNC recheck has been initiated for all contacts. This may take several minutes to complete."
          : "DNC check has been initiated for unchecked contacts. This may take a few minutes to complete.",
      });
    } catch (error) {
      console.error('Error starting DNC check:', error);
      toast({
        title: "Error",
        description: "Failed to start DNC check. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Button
      onClick={handleDNCCheck}
      disabled={checking || isRunning}
      variant={variant}
      size={size}
    >
      {(checking || isRunning) ? (
        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Shield className="h-4 w-4 mr-2" />
      )}
{(checking || isRunning) ? 'Checking...' : (forceRecheck ? 'Force Recheck All' : 'Run DNC Check')}
    </Button>
  );
};