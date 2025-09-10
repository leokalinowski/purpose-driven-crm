
import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, ChevronUp, ChevronDown, Activity } from 'lucide-react';
import { Contact } from '@/hooks/useContacts';
import { formatDistanceToNow } from 'date-fns';

interface ContactTableProps {
  contacts: Contact[];
  sortBy: keyof Contact;
  sortOrder: 'asc' | 'desc';
  onSort: (column: keyof Contact) => void;
  onOpenEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onViewActivities: (contact: Contact) => void;
}

export const ContactTable: React.FC<ContactTableProps> = ({
  contacts,
  sortBy,
  sortOrder,
  onSort,
  onOpenEdit,
  onDelete,
  onViewActivities,
}) => {

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
      <Table>
        <TableHeader>
          <TableRow>
            {sortableColumns.map(({ key, label }) => (
              <TableHead
                key={key}
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => onSort(key)}
              >
                {label}
                {getSortIcon(key)}
              </TableHead>
            ))}
            <TableHead>Address</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Activities</TableHead>
            <TableHead>DNC</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No contacts found
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact) => (
              <TableRow
                key={contact.id}
                className={contact.dnc ? "bg-destructive/10 hover:bg-destructive/20" : "hover:bg-muted/50"}
              >
                <TableCell>{renderCell(contact, 'first_name')}</TableCell>
                <TableCell>{renderCell(contact, 'last_name')}</TableCell>
                <TableCell>{renderCell(contact, 'phone')}</TableCell>
                <TableCell>{renderCell(contact, 'email')}</TableCell>
                <TableCell>{renderCell(contact, 'city')}</TableCell>
                <TableCell>{renderCell(contact, 'state')}</TableCell>
                <TableCell>
                  <div className="text-sm space-y-1">
                    <div>{contact.address_1 || '—'}</div>
                    {contact.address_2 && <div>{contact.address_2}</div>}
                    <div className="text-muted-foreground">{contact.zip_code || '—'}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags?.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {contact.activity_count || 0} activities
                      </Badge>
                    </div>
                    {contact.last_activity_date && (
                      <div className="text-xs text-muted-foreground">
                        Last: {formatDistanceToNow(new Date(contact.last_activity_date), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {contact.dnc && (
                    <Badge variant="destructive" className="text-xs">
                      DNC
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewActivities(contact)}
                      className="h-8 w-8 p-0"
                      title="View Activities"
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
  );
};
