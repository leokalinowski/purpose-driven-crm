import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus } from "lucide-react";
import { usePipeline } from "@/hooks/usePipeline";
import { useContacts } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";

interface AddOpportunityDialogProps {
  onOpportunityCreated: () => void;
}

export function AddOpportunityDialog({ onOpportunityCreated }: AddOpportunityDialogProps) {
  const [open, setOpen] = useState(false);
  const [contactMode, setContactMode] = useState<"existing" | "new">("existing");
  const [formData, setFormData] = useState({
    contact_id: "",
    stage: "lead",
    deal_value: "",
    expected_close_date: "",
    notes: ""
  });
  const [newContactData, setNewContactData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address_1: "",
    address_2: "",
    city: "",
    state: "",
    zip_code: "",
    tags: [] as string[],
    notes: ""
  });
  
  const { createOpportunity } = usePipeline();
  const { contacts, fetchContacts, addContact } = useContacts();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchContacts();
    }
  }, [open, fetchContacts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let contactId = formData.contact_id;
      
      if (contactMode === "new") {
        // Validate required fields for new contact
        if (!newContactData.first_name || !newContactData.last_name || !newContactData.phone || !newContactData.email) {
          toast({
            title: "Missing Information",
            description: "Please fill in all required contact fields (First Name, Last Name, Phone, Email)",
            variant: "destructive"
          });
          return;
        }
        
        // Create new contact first
        const newContact = await addContact({
          first_name: newContactData.first_name,
          last_name: newContactData.last_name,
          phone: newContactData.phone,
          email: newContactData.email,
          address_1: newContactData.address_1 || null,
          address_2: newContactData.address_2 || null,
          city: newContactData.city || null,
          state: newContactData.state || null,
          zip_code: newContactData.zip_code || null,
          tags: newContactData.tags.length > 0 ? newContactData.tags : null,
          notes: newContactData.notes || null,
          dnc: false
        });
        
        contactId = newContact.id;
        toast({
          title: "Contact Created",
          description: `${newContactData.first_name} ${newContactData.last_name} has been added to your database.`,
        });
      } else if (!formData.contact_id) {
        toast({
          title: "Contact Required",
          description: "Please select a contact for the opportunity.",
          variant: "destructive"
        });
        return;
      }

      // Create opportunity
      const success = await createOpportunity({
        contact_id: contactId,
        stage: formData.stage as any,
        deal_value: formData.deal_value ? parseFloat(formData.deal_value) : 0,
        expected_close_date: formData.expected_close_date || null,
        notes: formData.notes || null
      });

      if (success) {
        // Reset form
        setFormData({
          contact_id: "",
          stage: "lead",
          deal_value: "",
          expected_close_date: "",
          notes: ""
        });
        setNewContactData({
          first_name: "",
          last_name: "",
          phone: "",
          email: "",
          address_1: "",
          address_2: "",
          city: "",
          state: "",
          zip_code: "",
          tags: [],
          notes: ""
        });
        setContactMode("existing");
        setOpen(false);
        onOpportunityCreated();
        
        toast({
          title: "Opportunity Created",
          description: "The opportunity has been added to your pipeline.",
        });
      }
    } catch (error) {
      console.error('Error creating opportunity:', error);
      toast({
        title: "Error",
        description: "Failed to create opportunity. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Opportunity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Opportunity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>Contact Option</Label>
            <RadioGroup value={contactMode} onValueChange={(value: "existing" | "new") => setContactMode(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing" />
                <Label htmlFor="existing">Select Existing Contact</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new">Create New Contact</Label>
              </div>
            </RadioGroup>
          </div>

          {contactMode === "existing" ? (
            <div className="space-y-2">
              <Label htmlFor="contact">Contact</Label>
              <Select
                value={formData.contact_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, contact_id: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                      {contact.email && ` - ${contact.email}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={newContactData.first_name}
                    onChange={(e) => setNewContactData(prev => ({ ...prev, first_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={newContactData.last_name}
                    onChange={(e) => setNewContactData(prev => ({ ...prev, last_name: e.target.value }))}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={newContactData.phone}
                    onChange={(e) => setNewContactData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newContactData.email}
                    onChange={(e) => setNewContactData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_1">Address (Optional)</Label>
                <Input
                  id="address_1"
                  placeholder="Street Address"
                  value={newContactData.address_1}
                  onChange={(e) => setNewContactData(prev => ({ ...prev, address_1: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={newContactData.city}
                    onChange={(e) => setNewContactData(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={newContactData.state}
                    onChange={(e) => setNewContactData(prev => ({ ...prev, state: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip_code">Zip Code</Label>
                  <Input
                    id="zip_code"
                    value={newContactData.zip_code}
                    onChange={(e) => setNewContactData(prev => ({ ...prev, zip_code: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="stage">Stage</Label>
            <Select
              value={formData.stage}
              onValueChange={(value) => setFormData(prev => ({ ...prev, stage: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="appointment">Appointment</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal_value">Deal Value ($)</Label>
            <Input
              id="deal_value"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.deal_value}
              onChange={(e) => setFormData(prev => ({ ...prev, deal_value: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected_close_date">Expected Close Date</Label>
            <Input
              id="expected_close_date"
              type="date"
              value={formData.expected_close_date}
              onChange={(e) => setFormData(prev => ({ ...prev, expected_close_date: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this opportunity..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Create Opportunity
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}