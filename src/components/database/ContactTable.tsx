import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Contact } from '@/hooks/useContacts';
import { cn } from '@/lib/utils';

interface ContactTableProps {
  contacts: Contact[];
  sortBy: keyof Contact;
  sortOrder: 'asc' | 'desc';
  onSort: (column: keyof Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

export const ContactTable: React.FC<ContactTableProps> = ({
  contacts,
  sortBy,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
}) => {
  const getSortIcon = (column: keyof Contact) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    );
  };

  const sortableColumns: { key: keyof Contact; label: string }[] = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
  ];

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
            <TableHead>DNC</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                No contacts found
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact) => (
              <TableRow
                key={contact.id}
                className={cn(
                  "hover:bg-muted/50",
                  contact.dnc && "bg-red-50 hover:bg-red-100"
                )}
              >
                <TableCell className="font-medium">{contact.first_name}</TableCell>
                <TableCell className="font-medium">{contact.last_name}</TableCell>
                <TableCell>{contact.phone}</TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>{contact.city}</TableCell>
                <TableCell>{contact.state}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    {contact.address_1 && <div>{contact.address_1}</div>}
                    {contact.address_2 && <div>{contact.address_2}</div>}
                    {contact.zip_code && (
                      <div className="text-muted-foreground">{contact.zip_code}</div>
                    )}
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
                      onClick={() => onEdit(contact)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(contact)}
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
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