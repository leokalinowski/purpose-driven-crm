import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Shield } from 'lucide-react';
import { useDNCStats } from '@/hooks/useDNCStats';
import { useToast } from '@/components/ui/use-toast';

interface DNCCheckButtonProps {
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
}

export const DNCCheckButton: React.FC<DNCCheckButtonProps> = ({ 
  variant = 'outline',
  size = 'default'
}) => {
  const { triggerDNCCheck, checking } = useDNCStats();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);

  const handleDNCCheck = async () => {
    if (checking || isRunning) return;

    setIsRunning(true);
    try {
      await triggerDNCCheck(false); // false = don't force recheck
      toast({
        title: "DNC Check Started",
        description: "DNC check has been initiated. This may take a few minutes to complete.",
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
      {(checking || isRunning) ? 'Checking...' : 'Run DNC Check'}
    </Button>
  );
};