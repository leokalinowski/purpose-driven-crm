import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { SphereSyncTask } from '@/hooks/useSphereSyncTasks';
import { ContactQuickSheet } from './ContactQuickSheet';

interface OpenContactOptions {
  task?: SphereSyncTask | null;
  onEditContact?: (contactId: string) => void;
  onLogActivity?: (contactId: string, task?: SphereSyncTask | null) => void;
}

interface ContactSheetContextValue {
  openContact: (contactId: string, opts?: OpenContactOptions) => void;
  closeContact: () => void;
  isOpen: boolean;
  contactId: string | null;
}

const ContactSheetContext = createContext<ContactSheetContextValue | null>(null);

interface SheetState {
  contactId: string | null;
  task: SphereSyncTask | null;
  onEditContact?: (contactId: string) => void;
  onLogActivity?: (contactId: string, task?: SphereSyncTask | null) => void;
}

const emptyState: SheetState = {
  contactId: null,
  task: null,
};

export function ContactSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SheetState>(emptyState);

  const openContact = useCallback((contactId: string, opts?: OpenContactOptions) => {
    setState({
      contactId,
      task: opts?.task ?? null,
      onEditContact: opts?.onEditContact,
      onLogActivity: opts?.onLogActivity,
    });
  }, []);

  const closeContact = useCallback(() => {
    setState(emptyState);
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) closeContact();
  };

  return (
    <ContactSheetContext.Provider
      value={{
        openContact,
        closeContact,
        isOpen: state.contactId !== null,
        contactId: state.contactId,
      }}
    >
      {children}
      <ContactQuickSheet
        contactId={state.contactId}
        task={state.task}
        open={state.contactId !== null}
        onOpenChange={handleOpenChange}
        onEditContact={state.onEditContact}
        onLogActivity={state.onLogActivity}
      />
    </ContactSheetContext.Provider>
  );
}

export function useContactSheet(): ContactSheetContextValue {
  const ctx = useContext(ContactSheetContext);
  if (!ctx) {
    throw new Error('useContactSheet must be used inside <ContactSheetProvider>');
  }
  return ctx;
}
