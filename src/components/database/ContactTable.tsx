import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, ChevronUp, ChevronDown, Activity, Phone, Mail, Shield } from 'lucide-react';
import { Contact } from '@/hooks/useContacts';
import { ContactEnricher } from './ContactEnricher';
import { EnrichedContact } from '@/utils/dataEnrichment';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

function Initials({ first, last }: { first?: string | null; last?: string | null }) {
  const a = (first?.[0] ?? '').toUpperCase();
  const b = (last?.[0] ?? '').toUpperCase();
  const letters = a + b || '?';
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold select-none">
      {letters}
    </div>
  );
}

interface ContactTableProps {
  contacts: Contact[];
  sortBy: keyof Contact;
  sortOrder: 'asc' | 'desc';
  onSort: (column: keyof Contact) => void;
  onOpenEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onViewActivities: (contact: Contact) => void;
  onEnriched?: (enrichedContact: EnrichedContact) => void;
  selectedContacts?: Contact[];
  onSelectionChange?: (selectedContacts: Contact[]) => void;
  showSelection?: boolean;
  isAdmin?: boolean;
  onRecheckDNC?: (contact: Contact) => void;
}

export const ContactTable = ({
  contacts,
  sortBy,
  sortOrder,
  onSort,
  onOpenEdit,
  onDelete,
  onViewActivities,
  onEnriched,
  selectedContacts = [],
  onSelectionChange,
  showSelection = false,
  isAdmin = false,
  onRecheckDNC,
}: ContactTableProps) => {
  // Ensure contacts is always an array
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const safeSelectedContacts = Array.isArray(selectedContacts) ? selectedContacts : [];

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getSortIcon = (column: keyof Contact) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ChevronUp className="h-4 w-4 inline ml-1" /> : <ChevronDown className="h-4 w-4 inline ml-1" />;
  };

  const sortableColumns: { key: keyof Contact; label: string }[] = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
  ];

  const renderCell = (contact: Contact, field: keyof Contact) => {
    return contact[field] as string || '—';
  };

  // Mobile card component
  const ContactCard = ({ contact }: { contact: Contact }) => (
    <div className={cn(
      'rounded-xl border border-border bg-card p-4',
      contact.dnc && 'border-destructive/40 bg-destructive/5'
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {showSelection && (
            <input
              type="checkbox"
              className="rounded border-border mt-0.5"
              checked={safeSelectedContacts.some(c => c.id === contact.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  onSelectionChange?.([...safeSelectedContacts, contact]);
                } else {
                  onSelectionChange?.(safeSelectedContacts.filter(c => c.id !== contact.id));
                }
              }}
            />
          )}
          <Initials first={contact.first_name} last={contact.last_name} />
          <div className="min-w-0">
            <div className="font-semibold text-sm text-foreground truncate">
              {contact.first_name} {contact.last_name}
            </div>
            {contact.dnc && (
              <Badge variant="destructive" className="text-[10px] mt-0.5">DNC</Badge>
            )}
            {contact.tags && contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {contact.tags.slice(0, 2).map((tag, i) => (
                  <span key={i} className="inline-block rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{tag}</span>
                ))}
                {contact.tags.length > 2 && (
                  <span className="text-[10px] text-muted-foreground">+{contact.tags.length - 2}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {isAdmin && onRecheckDNC && contact.phone && (
            <button onClick={() => onRecheckDNC(contact)} title="Recheck DNC"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary transition-all">
              <Shield className="h-3.5 w-3.5" />
            </button>
          )}
          {onEnriched && <ContactEnricher contact={contact} onEnriched={onEnriched} />}
          <button onClick={() => onViewActivities(contact)} title="View Touchpoints"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary transition-all">
            <Activity className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onOpenEdit(contact)} title="Edit"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary transition-all">
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(contact)} title="Delete"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-destructive hover:border-destructive transition-all">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        {contact.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{contact.phone}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
          <span>{contact.activity_count || 0} touchpoints</span>
          {contact.last_activity_date && (
            <span>Last {formatDistanceToNow(new Date(contact.last_activity_date), { addSuffix: true })}</span>
          )}
        </div>
        {/* keep the unused div structure matched below */}
        <div className="hidden">
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {contact.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
              {contact.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">+{contact.tags.length - 3}</Badge>
              )}
            </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {contact.activity_count || 0} touchpoints
              {contact.last_activity_date && (
                <span className="ml-2">
                  • Last: {formatDistanceToNow(new Date(contact.last_activity_date), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Render mobile cards or desktop table
  if (isMobile) {
    return (
      <div className="space-y-3">
        {safeContacts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No contacts found
          </div>
        ) : (
          safeContacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))
        )}
      </div>
    );
  }

  // Desktop table view
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="min-w-full w-full">
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {showSelection && (
                <TableHead className="w-10 pl-4">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={safeSelectedContacts.length === safeContacts.length && safeContacts.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onSelectionChange?.(safeContacts);
                      } else {
                        onSelectionChange?.([]);
                      }
                    }}
                  />
                </TableHead>
              )}
              <TableHead
                className="cursor-pointer hover:bg-muted/50 select-none whitespace-nowrap pl-4 min-w-[180px]"
                onClick={() => onSort('first_name')}
              >
                Name {getSortIcon('first_name')}
              </TableHead>
              {[
                { key: 'phone' as keyof Contact, label: 'Phone' },
                { key: 'email' as keyof Contact, label: 'Email' },
                { key: 'city' as keyof Contact, label: 'City' },
                { key: 'state' as keyof Contact, label: 'State' },
              ].map(({ key, label }) => (
                <TableHead
                  key={key}
                  className="cursor-pointer hover:bg-muted/50 select-none whitespace-nowrap"
                  onClick={() => onSort(key)}
                >
                  {label} {getSortIcon(key)}
                </TableHead>
              ))}
              <TableHead className="whitespace-nowrap">Tags</TableHead>
              <TableHead className="whitespace-nowrap">Touchpoints</TableHead>
              <TableHead className="whitespace-nowrap text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showSelection ? 9 : 8} className="text-center py-10 text-muted-foreground">
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              safeContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className={cn(
                    'transition-colors',
                    contact.dnc ? 'bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-muted/30'
                  )}
                >
                  {showSelection && (
                    <TableCell className="w-10 pl-4">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={safeSelectedContacts.some(c => c.id === contact.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onSelectionChange?.([...safeSelectedContacts, contact]);
                          } else {
                            onSelectionChange?.(safeSelectedContacts.filter(c => c.id !== contact.id));
                          }
                        }}
                      />
                    </TableCell>
                  )}
                  {/* Name + avatar combined */}
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Initials first={contact.first_name} last={contact.last_name} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground whitespace-nowrap">
                          {contact.first_name} {contact.last_name}
                        </div>
                        {contact.dnc && (
                          <span className="text-[10px] font-semibold text-destructive">DNC</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{contact.phone || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground max-w-[180px] truncate">{contact.email || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{contact.city || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{contact.state || '—'}</TableCell>
                  <TableCell className="min-w-[150px]">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.slice(0, 3).map((tag, index) => (
                        <span key={index} className="inline-block rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {tag}
                        </span>
                      ))}
                      {(contact.tags?.length ?? 0) > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{contact.tags!.length - 3}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[120px]">
                    <div className="text-sm font-medium text-foreground">{contact.activity_count || 0}</div>
                    {contact.last_activity_date && (
                      <div className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(contact.last_activity_date), { addSuffix: true })}
                      </div>
                    )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap pr-4">
                    <div className="flex items-center gap-1 justify-end">
                      {isAdmin && onRecheckDNC && contact.phone && (
                        <button onClick={() => onRecheckDNC(contact)} title="Recheck DNC"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary transition-all">
                          <Shield className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onEnriched && <ContactEnricher contact={contact} onEnriched={onEnriched} />}
                      <button onClick={() => onViewActivities(contact)} title="View Touchpoints"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary transition-all">
                        <Activity className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onOpenEdit(contact)} title="Edit"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary transition-all">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onDelete(contact)} title="Delete"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-destructive hover:border-destructive transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
