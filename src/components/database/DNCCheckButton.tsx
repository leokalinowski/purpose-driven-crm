import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Shield } from 'lucide-react';

interface DNCCheckButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
  forceRecheck?: boolean;
  onRun: (forceRecheck: boolean) => Promise<void>;
  checking: boolean;
}

export const DNCCheckButton = ({ 
  variant = 'outline',
  size = 'default',
  forceRecheck = false,
  onRun,
  checking
}: DNCCheckButtonProps) => {
  const handleDNCCheck = async () => {
    if (checking) return;
    try {
      await onRun(forceRecheck);
    } catch (error) {
      console.error('DNC check button error:', error);
      // Error is handled by the parent component via toast
    }
  };

  return (
    <Button
      onClick={handleDNCCheck}
      disabled={checking}
      variant={variant}
      size={size}
    >
      {checking ? (
        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Shield className="h-4 w-4 mr-2" />
      )}
      {checking ? 'Checking...' : (forceRecheck ? 'Force Recheck All' : 'Run DNC Check')}
    </Button>
  );
};