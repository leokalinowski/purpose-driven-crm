import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { usePipeline } from "@/hooks/usePipeline";
import { useContacts } from "@/hooks/useContacts";

interface AddOpportunityDialogProps {
  onOpportunityCreated: () => void;
}

export function AddOpportunityDialog({ onOpportunityCreated }: AddOpportunityDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    contact_id: "",
    stage: "lead",
    deal_value: "",
    expected_close_date: "",
    notes: ""
  });
  
  const { createOpportunity } = usePipeline();
  const { contacts, fetchContacts } = useContacts();

  useEffect(() => {
    if (open) {
      fetchContacts();
    }
  }, [open, fetchContacts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.contact_id) {
      return;
    }

    const success = await createOpportunity({
      contact_id: formData.contact_id,
      stage: formData.stage as any,
      deal_value: formData.deal_value ? parseFloat(formData.deal_value) : 0,
      expected_close_date: formData.expected_close_date || null,
      notes: formData.notes || null
    });

    if (success) {
      setFormData({
        contact_id: "",
        stage: "lead",
        deal_value: "",
        expected_close_date: "",
        notes: ""
      });
      setOpen(false);
      onOpportunityCreated();
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