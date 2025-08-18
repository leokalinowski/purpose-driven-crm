import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Shield, Loader2, ChevronDown } from 'lucide-react';

interface DNCCheckButtonProps {
  onClick: (forceRecheck?: boolean) => void;
  loading: boolean;
  disabled?: boolean;
}

export const DNCCheckButton: React.FC<DNCCheckButtonProps> = ({ 
  onClick, 
  loading, 
  disabled = false 
}) => {
  if (loading) {
    return (
      <Button
        variant="outline"
        disabled={true}
        className="flex items-center gap-2"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking DNC...
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <Shield className="h-4 w-4" />
          Check DNC
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onClick(false)}>
          Check New & Old Contacts
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onClick(true)}>
          Force Check All Contacts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};