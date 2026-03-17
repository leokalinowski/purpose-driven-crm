import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface RSVPQuestion {
  id: string;
  event_id: string;
  question_text: string;
  question_type: 'text' | 'textarea' | 'select' | 'checkbox';
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RSVPAnswer {
  rsvp_id: string;
  question_id: string;
  question_text: string;
  question_type: string;
  answer_text: string;
  sort_order: number;
}

export const useRSVPQuestions = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Fetch questions for an event (public)
  const getEventQuestions = async (eventId: string): Promise<RSVPQuestion[]> => {
    const { data, error } = await supabase
      .from('event_rsvp_questions')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data || []) as RSVPQuestion[];
  };

  // Add a question (authenticated)
  const addQuestion = async (eventId: string, question: Partial<RSVPQuestion>): Promise<RSVPQuestion> => {
    const { data, error } = await supabase
      .from('event_rsvp_questions')
      .insert([{
        event_id: eventId,
        question_text: question.question_text,
        question_type: question.question_type || 'text',
        options: question.options || null,
        is_required: question.is_required || false,
        sort_order: question.sort_order || 0,
      }])
      .select()
      .single();

    if (error) throw error;
    return data as RSVPQuestion;
  };

  // Update a question
  const updateQuestion = async (questionId: string, updates: Partial<RSVPQuestion>): Promise<void> => {
    const { error } = await supabase
      .from('event_rsvp_questions')
      .update({
        question_text: updates.question_text,
        question_type: updates.question_type,
        options: updates.options,
        is_required: updates.is_required,
        sort_order: updates.sort_order,
      })
      .eq('id', questionId);

    if (error) throw error;
  };

  // Delete a question
  const deleteQuestion = async (questionId: string): Promise<void> => {
    const { error } = await supabase
      .from('event_rsvp_questions')
      .delete()
      .eq('id', questionId);

    if (error) throw error;
  };

  // Submit answers via RPC (public, no auth)
  const submitAnswers = async (rsvpId: string, answers: { question_id: string; answer_text: string }[]): Promise<void> => {
    if (answers.length === 0) return;

    const { error } = await supabase.rpc('submit_rsvp_answers', {
      p_rsvp_id: rsvpId,
      p_answers: answers,
    });

    if (error) throw error;
  };

  // Get answers for an event (authenticated, owner/admin only)
  const getEventAnswers = async (eventId: string): Promise<RSVPAnswer[]> => {
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase.rpc('get_rsvp_answers', {
      p_event_id: eventId,
    });

    if (error) throw error;
    return (data || []) as RSVPAnswer[];
  };

  return {
    loading,
    getEventQuestions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    submitAnswers,
    getEventAnswers,
  };
};
