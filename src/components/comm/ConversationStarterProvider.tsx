/**
 * Global provider for the ConversationStarterModal.
 *
 * Mount once near the top of the tree (App.tsx). Any component can call
 *   const { openStarter } = useConversationStarter();
 *   openStarter('call', contact);
 * to bring up the channel-aware starter sheet.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ConversationStarterModal } from './ConversationStarterModal';
import type { Channel } from '@/lib/conversationStarters';
import type { CommContact } from '@/lib/comm';

interface ConversationStarterContextValue {
  openStarter: (channel: Channel, contact: CommContact) => void;
  closeStarter: () => void;
}

const ConversationStarterContext = createContext<ConversationStarterContextValue | null>(null);

export function ConversationStarterProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [contact, setContact] = useState<CommContact | null>(null);

  const openStarter = useCallback((c: Channel, ct: CommContact) => {
    setChannel(c);
    setContact(ct);
    setOpen(true);
  }, []);

  const closeStarter = useCallback(() => {
    setOpen(false);
    // Don't reset channel/contact synchronously — the sheet's exit animation
    // would briefly render an empty state. The next openStarter() will replace
    // them, and unmount-by-route handles the rest.
  }, []);

  const value = useMemo<ConversationStarterContextValue>(
    () => ({ openStarter, closeStarter }),
    [openStarter, closeStarter],
  );

  return (
    <ConversationStarterContext.Provider value={value}>
      {children}
      <ConversationStarterModal
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
        }}
        channel={channel}
        contact={contact}
      />
    </ConversationStarterContext.Provider>
  );
}

export function useConversationStarter(): ConversationStarterContextValue {
  const ctx = useContext(ConversationStarterContext);
  if (!ctx) {
    throw new Error('useConversationStarter must be used within ConversationStarterProvider');
  }
  return ctx;
}
