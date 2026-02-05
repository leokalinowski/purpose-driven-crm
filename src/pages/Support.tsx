import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { ActionItemsBanner } from '@/components/support/ActionItemsBanner';
import { ActionItemsCard } from '@/components/support/ActionItemsCard';
import { TicketForm } from '@/components/support/TicketForm';
import { TicketHistory } from '@/components/support/TicketHistory';
import { Skeleton } from '@/components/ui/skeleton';
import { useActionItems } from '@/hooks/useActionItems';
import { useSupportTickets } from '@/hooks/useSupportTickets';

const Support = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const {
    highPriorityItems,
    otherItems,
    isLoading: actionItemsLoading,
    dismissItem,
  } = useActionItems();

  const {
    tickets,
    isLoading: ticketsLoading,
    createTicket,
    isCreating,
  } = useSupportTickets();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (user && !authLoading) {
      document.title = 'Support Hub | Real Estate on Purpose';
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  const handleDismiss = (id: string, dismissUntil?: Date) => {
    dismissItem({ id, dismissUntil });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <LifeBuoy className="h-8 w-8" />
            Support Hub
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Get help, track your requests, and complete action items to maximize your platform experience.
          </p>
        </div>

        {/* High Priority Action Items Banner */}
        {!actionItemsLoading && highPriorityItems.length > 0 && (
          <ActionItemsBanner
            items={highPriorityItems}
            onDismiss={(id) => handleDismiss(id)}
          />
        )}

        {/* Other Action Items */}
        {!actionItemsLoading && otherItems.length > 0 && (
          <ActionItemsCard
            items={otherItems}
            onDismiss={handleDismiss}
          />
        )}

        {/* Ticket Form */}
        <TicketForm onSubmit={createTicket} isSubmitting={isCreating} />

        {/* Ticket History */}
        <TicketHistory tickets={tickets} isLoading={ticketsLoading} />
      </div>
    </Layout>
  );
};

export default Support;
