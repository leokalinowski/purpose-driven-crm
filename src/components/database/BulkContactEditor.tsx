import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Users, Save } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Contact } from '@/hooks/useContacts';

interface BulkContactEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContacts: Contact[];
  onBulkUpdate: (updates: Partial<Contact>, contactIds: string[]) => Promise<void>;
}

export const BulkContactEditor: React.FC<BulkContactEditorProps> = ({
  open,
  onOpenChange,
  selectedContacts,
  onBulkUpdate,
}) => {
  const [updates, setUpdates] = useState<Partial<Contact>>({});
  const [loading, setLoading] = useState(false);

  const handleFieldChange = (field: keyof Contact, value: string) => {
    if (value === '') {
      // Remove field if set to empty
      const newUpdates = { ...updates };
      delete newUpdates[field];
      setUpdates(newUpdates);
    } else {
      setUpdates(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(updates).length === 0) {
      toast({
        title: "No Changes",
        description: "Please make at least one change to apply.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const contactIds = selectedContacts.map(c => c.id);
      await onBulkUpdate(updates, contactIds);

      toast({
        title: "Bulk Update Complete",
        description: `Successfully updated ${selectedContacts.length} contacts.`,
      });

      // Reset form and close
      setUpdates({});
      onOpenChange(false);
    } catch (error) {
      console.error('Bulk update failed:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUpdates({});
    onOpenChange(false);
  };

  const fieldsChanged = Object.keys(updates).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Edit Contacts ({selectedContacts.length} selected)
          </DialogTitle>
          <DialogDescription>
            Apply the same changes to all selected contacts. Fields left blank will not be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Preview of selected contacts */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-sm font-medium mb-2">Selected Contacts:</div>
            <div className="flex flex-wrap gap-1">
              {selectedContacts.slice(0, 5).map((contact) => (
                <span key={contact.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  {contact.first_name} {contact.last_name}
                </span>
              ))}
              {selectedContacts.length > 5 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground">
                  +{selectedContacts.length - 5} more
                </span>
              )}
            </div>
          </div>

          {/* Bulk edit form */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={updates.first_name || ''}
                onChange={(e) => handleFieldChange('first_name', e.target.value)}
                placeholder="Leave blank to keep existing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={updates.last_name || ''}
                onChange={(e) => handleFieldChange('last_name', e.target.value)}
                placeholder="Leave blank to keep existing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={updates.phone || ''}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
                placeholder="Leave blank to keep existing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={updates.email || ''}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                placeholder="Leave blank to keep existing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_1">Address Line 1</Label>
              <Input
                id="address_1"
                value={updates.address_1 || ''}
                onChange={(e) => handleFieldChange('address_1', e.target.value)}
                placeholder="Leave blank to keep existing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_2">Address Line 2</Label>
              <Input
                id="address_2"
                value={updates.address_2 || ''}
                onChange={(e) => handleFieldChange('address_2', e.target.value)}
                placeholder="Leave blank to keep existing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={updates.city || ''}
                onChange={(e) => handleFieldChange('city', e.target.value)}
                placeholder="Leave blank to keep existing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={updates.state || ''}
                onChange={(e) => handleFieldChange('state', e.target.value)}
                placeholder="Leave blank to keep existing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip_code">ZIP Code</Label>
              <Input
                id="zip_code"
                value={updates.zip_code || ''}
                onChange={(e) => handleFieldChange('zip_code', e.target.value)}
                placeholder="Leave blank to keep existing"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={updates.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                placeholder="Leave blank to keep existing notes"
                rows={3}
              />
            </div>
          </div>

          {/* Preview of changes */}
          {fieldsChanged > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">Changes to apply:</div>
                  <div className="text-sm space-y-1">
                    {Object.entries(updates).map(([field, value]) => (
                      <div key={field} className="flex justify-between">
                        <span className="capitalize">{field.replace('_', ' ')}:</span>
                        <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                          "{String(value)}"
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    These changes will be applied to all {selectedContacts.length} selected contacts.
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || fieldsChanged === 0}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update {selectedContacts.length} Contacts
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
