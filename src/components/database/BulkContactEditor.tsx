import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, AlertTriangle, Users, Save, Tag, Shield, Trash2, MapPin, FileText } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Contact } from '@/hooks/useContacts';

interface BulkContactEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContacts: Contact[];
  onBulkUpdate: (updates: Partial<Contact>, contactIds: string[]) => Promise<void>;
  onBulkDelete?: (contactIds: string[]) => Promise<void>;
}

export const BulkContactEditor = ({
  open,
  onOpenChange,
  selectedContacts,
  onBulkUpdate,
  onBulkDelete,
}: BulkContactEditorProps) => {
  const [updates, setUpdates] = useState<Partial<Contact>>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [tagsToAdd, setTagsToAdd] = useState('');
  const [tagsToRemove, setTagsToRemove] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    setTagsToAdd('');
    setTagsToRemove('');
    setConfirmDelete(false);
    setActiveTab('edit');
    onOpenChange(false);
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete || !confirmDelete) return;

    setLoading(true);
    try {
      const contactIds = selectedContacts.map(c => c.id);
      await onBulkDelete(contactIds);

      toast({
        title: "Bulk Delete Complete",
        description: `Successfully deleted ${selectedContacts.length} contacts.`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTagOperation = (operation: 'add' | 'remove') => {
    const tagInput = operation === 'add' ? tagsToAdd : tagsToRemove;
    if (!tagInput.trim()) return;

    const tags = tagInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    if (tags.length === 0) return;

    setUpdates(prev => {
      const currentTags = prev.tags || [];
      let newTags: string[];

      if (operation === 'add') {
        // Add new tags, avoiding duplicates
        newTags = [...new Set([...currentTags, ...tags])];
        setTagsToAdd('');
      } else {
        // Remove specified tags
        newTags = currentTags.filter(tag => !tags.includes(tag));
        setTagsToRemove('');
      }

      return { ...prev, tags: newTags };
    });
  };

  const fieldsChanged = Object.keys(updates).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Operations ({selectedContacts.length} selected)
          </DialogTitle>
          <DialogDescription>
            Perform bulk operations on selected contacts.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Edit Fields</span>
              <span className="sm:hidden">Edit</span>
            </TabsTrigger>
            <TabsTrigger value="tags" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Manage Tags</span>
              <span className="sm:hidden">Tags</span>
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Status</span>
              <span className="sm:hidden">Status</span>
            </TabsTrigger>
            <TabsTrigger value="delete" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete</span>
              <span className="sm:hidden">Delete</span>
            </TabsTrigger>
          </TabsList>

          {/* Preview of selected contacts */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-sm font-medium mb-2">Selected Contacts ({selectedContacts.length}):</div>
            <div className="flex flex-wrap gap-1">
              {selectedContacts.slice(0, 8).map((contact) => (
                <span key={contact.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  {contact.first_name} {contact.last_name}
                </span>
              ))}
              {selectedContacts.length > 8 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground">
                  +{selectedContacts.length - 8} more
                </span>
              )}
            </div>
          </div>

          <TabsContent value="edit" className="space-y-4">

          {/* Bulk edit form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="space-y-2 md:col-span-2">
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

          <TabsContent value="tags" className="space-y-4">
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Current Tags on Selected Contacts</h4>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(selectedContacts.flatMap(c => c.tags || []))).map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                  {Array.from(new Set(selectedContacts.flatMap(c => c.tags || []))).length === 0 && (
                    <span className="text-sm text-muted-foreground">No tags on selected contacts</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-tags">Add Tags (comma-separated)</Label>
                  <Input
                    id="add-tags"
                    value={tagsToAdd}
                    onChange={(e) => setTagsToAdd(e.target.value)}
                    placeholder="new-tag, another-tag"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTagOperation('add')}
                    disabled={!tagsToAdd.trim()}
                    className="w-full"
                  >
                    <Tag className="h-4 w-4 mr-2" />
                    Add Tags
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remove-tags">Remove Tags (comma-separated)</Label>
                  <Input
                    id="remove-tags"
                    value={tagsToRemove}
                    onChange={(e) => setTagsToRemove(e.target.value)}
                    placeholder="tag-to-remove, another-tag"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTagOperation('remove')}
                    disabled={!tagsToRemove.trim()}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Tags
                  </Button>
                </div>
              </div>

              {updates.tags && updates.tags.length > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Tags to apply:</div>
                  <div className="flex flex-wrap gap-1">
                    {updates.tags.map((tag) => (
                      <Badge key={tag} variant="default">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !updates.tags}
                  className="flex-1"
                >
                  {loading ? 'Updating...' : 'Update Tags'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Current Status Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">DNC Listed: </span>
                    <span className="font-medium">{selectedContacts.filter(c => c.dnc).length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Safe to Call: </span>
                    <span className="font-medium">{selectedContacts.filter(c => !c.dnc).length}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dnc-toggle"
                    checked={updates.dnc === true}
                    onCheckedChange={(checked) => {
                      setUpdates(prev => ({ ...prev, dnc: checked as boolean }));
                    }}
                  />
                  <Label htmlFor="dnc-toggle" className="text-sm font-medium">
                    Mark all selected contacts as DNC (Do Not Call)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="safe-toggle"
                    checked={updates.dnc === false}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setUpdates(prev => ({ ...prev, dnc: false }));
                      } else {
                        setUpdates(prev => {
                          const newUpdates = { ...prev };
                          delete newUpdates.dnc;
                          return newUpdates;
                        });
                      }
                    }}
                  />
                  <Label htmlFor="safe-toggle" className="text-sm font-medium">
                    Mark all selected contacts as Safe to Call
                  </Label>
                </div>
              </div>

              {updates.dnc !== undefined && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    This will {updates.dnc ? 'mark' : 'unmark'} all {selectedContacts.length} selected contacts as {updates.dnc ? 'DNC (Do Not Call)' : 'Safe to Call'}.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading || updates.dnc === undefined}
                  className="flex-1"
                >
                  {loading ? 'Updating...' : 'Update Status'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="delete" className="space-y-4">
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-medium">Danger Zone</div>
                    <div>This action will permanently delete all {selectedContacts.length} selected contacts. This cannot be undone.</div>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Contacts to be deleted:</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedContacts.slice(0, 10).map((contact) => (
                    <span key={contact.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-destructive/10 text-destructive">
                      {contact.first_name} {contact.last_name}
                    </span>
                  ))}
                  {selectedContacts.length > 10 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground">
                      +{selectedContacts.length - 10} more
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirm-delete"
                  checked={confirmDelete}
                  onCheckedChange={(checked) => setConfirmDelete(checked as boolean)}
                />
                <Label htmlFor="confirm-delete" className="text-sm font-medium">
                  I understand this action cannot be undone
                </Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={loading || !confirmDelete || !onBulkDelete}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete {selectedContacts.length} Contacts
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
