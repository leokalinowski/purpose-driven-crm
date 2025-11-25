import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, ChevronUp, ChevronDown, Activity } from 'lucide-react';
import { Contact } from '@/hooks/useContacts';
import { ContactEnricher } from './ContactEnricher';
import { EnrichedContact } from '@/utils/dataEnrichment';
import { formatDistanceToNow } from 'date-fns';

interface ContactTableProps {
  contacts: Contact[];
  sortBy: keyof Contact;
  sortOrder: 'asc' | 'desc';
  onSort: (column: keyof Contact) => void;
  onOpenEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onViewActivities: (contact: Contact) => void;
  onEnriched?: (enrichedContact: EnrichedContact) => void;
  // Selection props
  selectedContacts?: Contact[];
  onSelectionChange?: (selectedContacts: Contact[]) => void;
  showSelection?: boolean;
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
}: ContactTableProps) => {
  // Ensure contacts is always an array
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const safeSelectedContacts = Array.isArray(selectedContacts) ? selectedContacts : [];

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

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <Table className="min-w-full w-full">
          <TableHeader>
            <TableRow>
              {showSelection && (
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
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
              {sortableColumns.map(({ key, label }) => (
                <TableHead
                  key={key}
                  className="cursor-pointer hover:bg-muted/50 select-none whitespace-nowrap"
                  onClick={() => onSort(key)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Sort by ${label}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSort(key);
                    }
                  }}
                >
                  {label}
                  {getSortIcon(key)}
                </TableHead>
              ))}
              <TableHead className="whitespace-nowrap">Address</TableHead>
              <TableHead className="whitespace-nowrap">Tags</TableHead>
              <TableHead className="whitespace-nowrap">Touchpoints</TableHead>
              <TableHead className="whitespace-nowrap">DNC</TableHead>
              <TableHead className="whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showSelection ? 10 : 9} className="text-center py-8 text-muted-foreground">
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              safeContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className={contact.dnc ? "bg-destructive/10 hover:bg-destructive/20" : "hover:bg-muted/50"}
                >
                  {showSelection && (
                    <TableCell className="w-12">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
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
                  <TableCell className="whitespace-nowrap">{renderCell(contact, 'first_name')}</TableCell>
                  <TableCell className="whitespace-nowrap">{renderCell(contact, 'last_name')}</TableCell>
                  <TableCell className="whitespace-nowrap">{renderCell(contact, 'phone')}</TableCell>
                  <TableCell className="whitespace-nowrap">{renderCell(contact, 'email')}</TableCell>
                  <TableCell className="whitespace-nowrap">{renderCell(contact, 'city')}</TableCell>
                  <TableCell className="whitespace-nowrap">{renderCell(contact, 'state')}</TableCell>
                  <TableCell className="min-w-[200px]">
                    <div className="text-sm space-y-1">
                      <div className="truncate">{contact.address_1 || '—'}</div>
                      {contact.address_2 && <div className="truncate">{contact.address_2}</div>}
                      <div className="text-muted-foreground truncate">{contact.zip_code || '—'}</div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[150px]">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[120px]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {contact.activity_count || 0} touchpoints
                        </Badge>
                      </div>
                      {contact.last_activity_date && (
                        <div className="text-xs text-muted-foreground">
                          Last: {formatDistanceToNow(new Date(contact.last_activity_date), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {contact.dnc && (
                      <Badge variant="destructive" className="text-xs">
                        DNC
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex space-x-1">
                      {onEnriched && (
                        <ContactEnricher
                          contact={contact}
                          onEnriched={onEnriched}
                        />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewActivities(contact)}
                        className="h-8 w-8 p-0"
                        title="View Touchpoints"
                      >
                        <Activity className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenEdit(contact)}
                        className="h-8 w-8 p-0"
                        title="Edit Contact"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(contact)}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        title="Delete Contact"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
