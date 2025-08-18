import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Opportunity {
  id: string;
  agent_id: string;
  contact_id: string;
  stage: 'lead' | 'qualified' | 'appointment' | 'contract' | 'closed';
  deal_value: number;
  expected_close_date: string | null;
  actual_close_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contact?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    zip_code: string;
    dnc: boolean;
    dnc_last_checked: string;
    tags: string[];
    notes: string;
    category: string;
  };
}

export interface PipelineMetrics {
  pipelineValue: number;
  winRate: number;
  avgCloseTime: number;
  totalOpportunities: number;
  closedDeals: number;
  stageBreakdown: Record<string, number>;
}

export function usePipeline() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics>({
    pipelineValue: 0,
    winRate: 0,
    avgCloseTime: 0,
    totalOpportunities: 0,
    closedDeals: 0,
    stageBreakdown: {}
  });
  const [loading, setLoading] = useState(true);

  const fetchOpportunities = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          contact:contacts(
            first_name,
            last_name,
            email,
            phone,
            address_1,
            address_2,
            city,
            state,
            zip_code,
            dnc,
            dnc_last_checked,
            tags,
            notes,
            category
          )
        `)
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const opportunitiesData = (data || []) as Opportunity[];
      setOpportunities(opportunitiesData);
      calculateMetrics(opportunitiesData);
    } catch (error: any) {
      console.error('Failed to load pipeline:', error);
      toast({
        title: "Error",
        description: "Failed to load pipeline data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (data: Opportunity[]) => {
    const totalOpportunities = data.length;
    const closedDeals = data.filter(o => o.stage === 'closed').length;
    const pipelineValue = data
      .filter(o => o.stage !== 'closed')
      .reduce((sum, o) => sum + (o.deal_value || 0), 0);
    
    const winRate = totalOpportunities > 0 ? (closedDeals / totalOpportunities) * 100 : 0;
    
    // Calculate average close time for closed deals
    const closedOpportunities = data.filter(o => o.stage === 'closed' && o.actual_close_date);
    const avgCloseTime = closedOpportunities.length > 0 
      ? closedOpportunities.reduce((sum, o) => {
          const created = new Date(o.created_at);
          const closed = new Date(o.actual_close_date!);
          return sum + (closed.getTime() - created.getTime());
        }, 0) / closedOpportunities.length / (1000 * 60 * 60 * 24) // Convert to days
      : 0;

    // Stage breakdown
    const stageBreakdown = data.reduce((acc, o) => {
      acc[o.stage] = (acc[o.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    setMetrics({
      pipelineValue,
      winRate,
      avgCloseTime,
      totalOpportunities,
      closedDeals,
      stageBreakdown
    });
  };

  const updateStage = async (opportunityId: string, newStage: string) => {
    try {
      const updateData: any = { 
        stage: newStage,
        updated_at: new Date().toISOString()
      };
      
      // If moving to closed, set actual close date
      if (newStage === 'closed') {
        updateData.actual_close_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('opportunities')
        .update(updateData)
        .eq('id', opportunityId);

      if (error) throw error;
      
      await fetchOpportunities();
      toast({
        title: "Success",
        description: "Opportunity stage updated"
      });
    } catch (error: any) {
      console.error('Update failed:', error);
      toast({
        title: "Error",
        description: "Failed to update opportunity stage",
        variant: "destructive"
      });
    }
  };

  const createOpportunity = async (data: Partial<Opportunity>) => {
    if (!user?.id) return;
    
    try {
      const insertData = {
        contact_id: data.contact_id,
        stage: data.stage || 'lead',
        deal_value: data.deal_value || 0,
        expected_close_date: data.expected_close_date,
        notes: data.notes,
        agent_id: user.id
      };
      
      const { error } = await supabase
        .from('opportunities')
        .insert(insertData);

      if (error) throw error;
      
      await fetchOpportunities();
      toast({
        title: "Success",
        description: "Opportunity created successfully"
      });
      return true;
    } catch (error: any) {
      console.error('Create failed:', error);
      toast({
        title: "Error",
        description: "Failed to create opportunity",
        variant: "destructive"
      });
      return false;
    }
  };

  const updateOpportunity = async (opportunityId: string, data: Partial<Opportunity>) => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', opportunityId);

      if (error) throw error;
      
      await fetchOpportunities();
      toast({
        title: "Success",
        description: "Opportunity updated successfully"
      });
      return true;
    } catch (error: any) {
      console.error('Update failed:', error);
      toast({
        title: "Error",
        description: "Failed to update opportunity",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteOpportunity = async (opportunityId: string) => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', opportunityId);

      if (error) throw error;
      
      await fetchOpportunities();
      toast({
        title: "Success",
        description: "Opportunity deleted successfully"
      });
      return true;
    } catch (error: any) {
      console.error('Delete failed:', error);
      toast({
        title: "Error",
        description: "Failed to delete opportunity",
        variant: "destructive"
      });
      return false;
    }
  };

  const updateContact = async (contactId: string, contactData: any) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          ...contactData,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId);

      if (error) throw error;
      
      // Trigger DNC check if phone number was updated
      if (contactData.phone) {
        try {
          await supabase.functions.invoke('dnc-single-check', {
            body: { contactId }
          });
        } catch (dncError) {
          console.warn('DNC check failed:', dncError);
        }
      }
      
      await fetchOpportunities();
      toast({
        title: "Success",
        description: "Contact updated successfully"
      });
      return true;
    } catch (error: any) {
      console.error('Contact update failed:', error);
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [user?.id]);

  return {
    opportunities,
    metrics,
    loading,
    updateStage,
    createOpportunity,
    updateOpportunity,
    deleteOpportunity,
    updateContact,
    refresh: fetchOpportunities
  };
}