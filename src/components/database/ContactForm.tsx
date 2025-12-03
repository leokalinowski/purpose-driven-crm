import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Contact, ContactInput } from '@/hooks/useContacts';
import { supabase } from '@/integrations/supabase/client';

// Comprehensive input validation schema
const contactSchema = z.object({
  first_name: z.string()
    .trim()
    .max(100, "First name must be less than 100 characters")
    .regex(/^[a-zA-Z\s'-]*$/, "First name can only contain letters, spaces, hyphens, and apostrophes")
    .optional()
    .or(z.literal("")),
  last_name: z.string()
    .trim()
    .min(1, "Last name is required")
    .max(100, "Last name must be less than 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Last name can only contain letters, spaces, hyphens, and apostrophes"),
  email: z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  phone: z.string()
    .trim()
    .regex(/^[\d\s\-\(\)\+\.]*$/, "Phone number can only contain digits, spaces, and standard punctuation")
    .max(20, "Phone number must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  address_1: z.string()
    .trim()
    .max(255, "Address must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  address_2: z.string()
    .trim()
    .max(255, "Address line 2 must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  city: z.string()
    .trim()
    .max(100, "City must be less than 100 characters")
    .regex(/^[a-zA-Z\s'-]*$/, "City can only contain letters, spaces, hyphens, and apostrophes")
    .optional()
    .or(z.literal("")),
  state: z.string()
    .trim()
    .max(2, "State must be 2 characters")
    .regex(/^[A-Z]{0,2}$/, "State must be uppercase letters")
    .optional()
    .or(z.literal("")),
  zip_code: z.string()
    .trim()
    .regex(/^(\d{5}(-\d{4})?)?$/, "Zip code must be 5 digits or 5+4 format")
    .optional()
    .or(z.literal("")),
  notes: z.string()
    .trim()
    .max(2000, "Notes must be less than 2000 characters")
    .optional()
    .or(z.literal("")),
  dnc: z.boolean().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  onSubmit: (data: ContactInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  title: string;
}

export const ContactForm = ({
  open,
  onOpenChange,
  contact,
  onSubmit,
  onDelete,
  title,
}: ContactFormProps) => {
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
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
    },
  });

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  useEffect(() => {
    if (contact && open) {
      reset({
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
    } else if (!open) {
      reset();
      setTagsInput('');
    }
  }, [contact, open, reset]);

  const handleSubmit = async (data: ContactFormData) => {
    setLoading(true);

    try {
      const tags = tagsInput
        .split(',')
        .map(tag => tag.trim().substring(0, 50))
        .filter(tag => tag.length > 0);

      // Ensure all required fields are present for ContactInput type
      const contactInput: ContactInput = {
        first_name: data.first_name || '',
        last_name: data.last_name,
        email: data.email || '',
        phone: data.phone || '',
        address_1: data.address_1 || '',
        address_2: data.address_2 || '',
        city: data.city || '',
        state: data.state || '',
        zip_code: data.zip_code || '',
        notes: data.notes || '',
        dnc: data.dnc || false,
        tags: tags.length > 0 ? tags : null,
      };

      await onSubmit(contactInput);
      
      // If contact has a phone number, trigger DNC check automatically in background
      if (contactInput.phone && contact?.id) {
        supabase.functions.invoke('dnc-single-check', {
          body: { phone: contactInput.phone, contactId: contact.id }
        }).catch(error => {
          console.error('Background DNC check failed:', error);
        });
      }
      
      onOpenChange(false);
      reset();
      setTagsInput('');
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleFormSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                {...register('first_name')}
                placeholder="John"
                maxLength={100}
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                {...register('last_name')}
                placeholder="Doe"
                maxLength={100}
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                {...register('phone', {
                  onChange: (e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    setValue('phone', formatted);
                  }
                })}
                placeholder="(555) 123-4567"
                maxLength={20}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="john@example.com"
                maxLength={255}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address_1">Address 1</Label>
            <Input
              id="address_1"
              {...register('address_1')}
              placeholder="123 Main St"
              maxLength={255}
            />
            {errors.address_1 && (
              <p className="text-sm text-destructive">{errors.address_1.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address_2">Address 2</Label>
            <Input
              id="address_2"
              {...register('address_2')}
              placeholder="Apt 4B"
              maxLength={255}
            />
            {errors.address_2 && (
              <p className="text-sm text-destructive">{errors.address_2.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                {...register('city')}
                placeholder="New York"
                maxLength={100}
              />
              {errors.city && (
                <p className="text-sm text-destructive">{errors.city.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                {...register('state', {
                  onChange: (e) => {
                    setValue('state', e.target.value.toUpperCase());
                  }
                })}
                placeholder="NY"
                maxLength={2}
                style={{ textTransform: 'uppercase' }}
              />
              {errors.state && (
                <p className="text-sm text-destructive">{errors.state.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="zip_code">Zip Code</Label>
              <Input
                id="zip_code"
                {...register('zip_code')}
                placeholder="10001"
                maxLength={10}
              />
              {errors.zip_code && (
                <p className="text-sm text-destructive">{errors.zip_code.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="client, lead, prospect"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">Max 50 characters per tag</p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="dnc"
              checked={watch('dnc')}
              onCheckedChange={(checked) => setValue('dnc', checked as boolean)}
            />
            <Label htmlFor="dnc">Do Not Contact (DNC)</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Additional notes about this contact..."
              rows={3}
              maxLength={2000}
            />
            {errors.notes && (
              <p className="text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>

          <div className="flex justify-between items-center pt-4">
            {onDelete && contact && (
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (window.confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
                    try {
                      await onDelete();
                      onOpenChange(false);
                    } catch (error) {
                      console.error('Error deleting contact:', error);
                    }
                  }
                }}
              >
                Delete Contact
              </Button>
            )}
            <div className="flex space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Contact'}
            </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};