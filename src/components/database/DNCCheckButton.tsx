import React from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Loader2 } from 'lucide-react';

interface DNCCheckButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
}

export const DNCCheckButton: React.FC<DNCCheckButtonProps> = ({ 
  onClick, 
  loading, 
  disabled = false 
}) => {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      disabled={loading || disabled}
      className="flex items-center gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Shield className="h-4 w-4" />
      )}
      {loading ? 'Checking DNC...' : 'Check DNC'}
    </Button>
  );
};