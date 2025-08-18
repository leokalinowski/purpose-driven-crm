import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Opportunity } from "@/hooks/usePipeline";
import { usePipeline } from "@/hooks/usePipeline";
import { format } from "date-fns";

interface EditOpportunityDialogProps {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpportunityUpdated: () => void;
}

export function EditOpportunityDialog({ 
  opportunity, 
  open, 
  onOpenChange, 
  onOpportunityUpdated 
}: EditOpportunityDialogProps) {
  const [formData, setFormData] = useState({
    stage: "",
    deal_value: "",
    expected_close_date: "",
    notes: ""
  });
  
  const { updateOpportunity } = usePipeline();

  useEffect(() => {
    if (opportunity) {
      setFormData({
        stage: opportunity.stage,
        deal_value: opportunity.deal_value?.toString() || "",
        expected_close_date: opportunity.expected_close_date 
          ? format(new Date(opportunity.expected_close_date), 'yyyy-MM-dd')
          : "",
        notes: opportunity.notes || ""
      });
    }
  }, [opportunity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!opportunity) return;

    const success = await updateOpportunity(opportunity.id, {
      stage: formData.stage as any,
      deal_value: formData.deal_value ? parseFloat(formData.deal_value) : 0,
      expected_close_date: formData.expected_close_date || null,
      notes: formData.notes || null
    });

    if (success) {
      onOpenChange(false);
      onOpportunityUpdated();
    }
  };

  if (!opportunity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Edit Opportunity - {opportunity.contact?.first_name} {opportunity.contact?.last_name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="Add notes about discussions, follow-ups, or important details..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={4}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Update Opportunity
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}