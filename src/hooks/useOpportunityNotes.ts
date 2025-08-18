import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface OpportunityNote {
  id: string;
  opportunity_id: string;
  agent_id: string;
  note_text: string;
  note_type: string;
  created_at: string;
  updated_at: string;
}

export const useOpportunityNotes = (opportunityId: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<OpportunityNote[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = async () => {
    if (!user || !opportunityId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opportunity_notes')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast({
        title: "Error",
        description: "Failed to load notes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addNote = async (noteText: string, noteType: string = 'general') => {
    if (!user || !opportunityId) return false;

    try {
      const { data, error } = await supabase
        .from('opportunity_notes')
        .insert({
          opportunity_id: opportunityId,
          agent_id: user.id,
          note_text: noteText,
          note_type: noteType
        })
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Note added successfully"
      });
      return true;
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive"
      });
      return false;
    }
  };

  const updateNote = async (noteId: string, noteText: string) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('opportunity_notes')
        .update({ note_text: noteText })
        .eq('id', noteId)
        .eq('agent_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => 
        prev.map(note => note.id === noteId ? data : note)
      );
      toast({
        title: "Success",
        description: "Note updated successfully"
      });
      return true;
    } catch (error) {
      console.error('Error updating note:', error);
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('opportunity_notes')
        .delete()
        .eq('id', noteId)
        .eq('agent_id', user.id);

      if (error) throw error;

      setNotes(prev => prev.filter(note => note.id !== noteId));
      toast({
        title: "Success",
        description: "Note deleted successfully"
      });
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [user, opportunityId]);

  return {
    notes,
    loading,
    addNote,
    updateNote,
    deleteNote,
    refetch: fetchNotes
  };
};