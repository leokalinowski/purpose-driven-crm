import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Contact, ContactInput } from '@/hooks/useContacts';

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  onSubmit: (data: ContactInput) => Promise<void>;
  title: string;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  open,
  onOpenChange,
  contact,
  onSubmit,
  title,
}) => {
  const [formData, setFormData] = useState<ContactInput>({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    address_1: '',
    address_2: '',
    zip_code: '',
    state: '',
    city: '',
    tags: [],
    dnc: false,
    notes: '',
  });
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        phone: contact.phone || '',
        email: contact.email || '',
        address_1: contact.address_1 || '',
        address_2: contact.address_2 || '',
        zip_code: contact.zip_code || '',
        state: contact.state || '',
        city: contact.city || '',
        tags: contact.tags || [],
        dnc: contact.dnc || false,
        notes: contact.notes || '',
      });
      setTagsInput(contact.tags?.join(', ') || '');
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        address_1: '',
        address_2: '',
        zip_code: '',
        state: '',
        city: '',
        tags: [],
        dnc: false,
        notes: '',
      });
      setTagsInput('');
    }
  }, [contact, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tags = tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      await onSubmit({
        ...formData,
        tags: tags.length > 0 ? tags : null,
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ContactInput, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                placeholder="Enter first name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                placeholder="Enter last name"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter email address"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address_1">Address 1</Label>
            <Input
              id="address_1"
              value={formData.address_1}
              onChange={(e) => handleInputChange('address_1', e.target.value)}
              placeholder="Enter street address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address_2">Address 2</Label>
            <Input
              id="address_2"
              value={formData.address_2}
              onChange={(e) => handleInputChange('address_2', e.target.value)}
              placeholder="Enter apartment, suite, etc. (optional)"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="Enter city"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                placeholder="Enter state"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="zip_code">Zip Code</Label>
              <Input
                id="zip_code"
                value={formData.zip_code}
                onChange={(e) => handleInputChange('zip_code', e.target.value)}
                placeholder="Enter zip code"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="client, lead, prospect"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="dnc"
              checked={formData.dnc}
              onCheckedChange={(checked) => handleInputChange('dnc', checked)}
            />
            <Label htmlFor="dnc">Do Not Contact (DNC)</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Enter additional notes"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Contact'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};