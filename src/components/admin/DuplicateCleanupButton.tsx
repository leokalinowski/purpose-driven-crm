import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DuplicateCleanupButtonProps {
  agentId: string;
  agentName: string;
  onCleanupComplete?: () => void;
}

export const DuplicateCleanupButton: React.FC<DuplicateCleanupButtonProps> = ({
  agentId,
  agentName,
  onCleanupComplete
}) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleCleanup = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-contacts-cleanup', {
        body: {
          agentId,
          adminUserId: user.id
        }
      });

      if (error) throw error;

      toast({
        title: 'Cleanup Complete',
        description: `Removed ${data.duplicatesRemoved} duplicates for ${agentName}. ${data.remainingContacts} unique contacts remain.`,
      });

      onCleanupComplete?.();
    } catch (error: any) {
      console.error('Cleanup failed:', error);
      toast({
        title: 'Cleanup Failed',
        description: error.message || 'Failed to remove duplicates',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Remove Duplicates
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Remove Duplicate Contacts
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will scan all contacts for <strong>{agentName}</strong> and remove duplicates based on matching names, emails, and phone numbers.
            </p>
            <p className="text-sm text-muted-foreground">
              The most recently created contact will be kept for each duplicate group. This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleCleanup} disabled={loading} className="bg-destructive hover:bg-destructive/90">
            {loading ? 'Removing...' : 'Remove Duplicates'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};