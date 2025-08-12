import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Edit, Trash2, ChevronUp, ChevronDown, Save } from 'lucide-react';
import { Contact } from '@/hooks/useContacts';
import { cn } from '@/lib/utils';

interface ContactTableProps {
  contacts: Contact[];
  sortBy: keyof Contact;
  sortOrder: 'asc' | 'desc';
  onSort: (column: keyof Contact) => void;
  onEdit: (contact: Contact) => Promise<void>; // Changed to async for save
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<keyof Contact | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const startEdit = (contact: Contact, field: keyof Contact) => {
    setEditingId(contact.id);
    setEditingField(field);
    setEditingValue(String(contact[field] || ''));
  };

  const saveEdit = async (contact: Contact) => {
    if (!editingField) return;
    const updated = { ...contact, [editingField]: editingValue };
    await onEdit(updated); // Save to database
    setEditingId(null);
    setEditingField(null);
  };

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

  const editableFields: (keyof Contact)[] = ['first_name', 'last_name', 'phone', 'email', 'address_1', 'address_2', 'city', 'state', 'zip_code', 'notes'];

  const renderCell = (contact: Contact, field: keyof Contact) => {
    if (editingId === contact.id && editingField === field && editableFields.includes(field)) {
      return (
        <div className="flex items-center gap-2">
          <Input
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            className="h-8"
            onKeyDown={(e) => e.key === 'Enter' && saveEdit(contact)}
          />
          <Button variant="ghost" size="sm" onClick={() => saveEdit(contact)} className="h-8 w-8 p-0">
            <Save className="h-4 w-4" />
          </Button>
        </div>
      );
    }
    return (
      <div onDoubleClick={() => editableFields.includes(field) && startEdit(contact, field)} className="cursor-text">
        {contact[field] as string || '—'}
      </div>
    );
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
                <TableCell>{renderCell(contact, 'first_name')}</TableCell>
                <TableCell>{renderCell(contact, 'last_name')}</TableCell>
                <TableCell>{renderCell(contact, 'phone')}</TableCell>
                <TableCell>{renderCell(contact, 'email')}</TableCell>
                <TableCell>{renderCell(contact, 'city')}</TableCell>
                <TableCell>{renderCell(contact, 'state')}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    {renderCell(contact, 'address_1')}
                    {renderCell(contact, 'address_2')}
                    {renderCell(contact, 'zip_code')}
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