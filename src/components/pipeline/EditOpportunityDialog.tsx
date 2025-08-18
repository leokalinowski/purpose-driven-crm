import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Opportunity } from "@/hooks/usePipeline";
import { usePipeline } from "@/hooks/usePipeline";
import { format } from "date-fns";
import { Shield, ShieldCheck, MapPin, Mail, Phone, User, Calendar, Tag } from "lucide-react";

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

  const getDNCStatus = () => {
    if (!opportunity.contact?.dnc_last_checked) {
      return { icon: Shield, color: 'text-yellow-500', bg: 'bg-yellow-100', text: 'Not Checked' };
    }
    if (opportunity.contact?.dnc) {
      return { icon: Shield, color: 'text-red-500', bg: 'bg-red-100', text: 'Do Not Call' };
    }
    return { icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-100', text: 'Safe to Call' };
  };

  const dncStatus = getDNCStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {opportunity.contact?.first_name} {opportunity.contact?.last_name}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="opportunity" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="opportunity">Opportunity</TabsTrigger>
            <TabsTrigger value="contact">Contact Details</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="opportunity" className="space-y-4">
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
                <Label htmlFor="notes">Opportunity Notes</Label>
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
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <div className="space-y-4">
              {/* DNC Status */}
              <div className="flex items-center gap-2">
                <dncStatus.icon className={`h-5 w-5 ${dncStatus.color}`} />
                <Badge variant="secondary" className={`${dncStatus.bg} ${dncStatus.color} border-current`}>
                  {dncStatus.text}
                </Badge>
                {opportunity.contact?.dnc_last_checked && (
                  <span className="text-xs text-muted-foreground">
                    Last checked: {format(new Date(opportunity.contact.dnc_last_checked), 'MMM dd, yyyy')}
                  </span>
                )}
              </div>

              <Separator />

              {/* Contact Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Name
                  </Label>
                  <p className="text-sm">{opportunity.contact?.first_name} {opportunity.contact?.last_name}</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Category
                  </Label>
                  <Badge variant="outline">{opportunity.contact?.category}</Badge>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <p className="text-sm">{opportunity.contact?.email || 'Not provided'}</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </Label>
                  <p className="text-sm">{opportunity.contact?.phone || 'Not provided'}</p>
                </div>
              </div>

              <Separator />

              {/* Address */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address
                </Label>
                <div className="text-sm space-y-1">
                  {opportunity.contact?.address_1 && <p>{opportunity.contact.address_1}</p>}
                  {opportunity.contact?.address_2 && <p>{opportunity.contact.address_2}</p>}
                  {(opportunity.contact?.city || opportunity.contact?.state || opportunity.contact?.zip_code) && (
                    <p>
                      {opportunity.contact?.city}{opportunity.contact?.city && opportunity.contact?.state ? ', ' : ''}
                      {opportunity.contact?.state} {opportunity.contact?.zip_code}
                    </p>
                  )}
                  {!opportunity.contact?.address_1 && !opportunity.contact?.city && (
                    <p className="text-muted-foreground">No address provided</p>
                  )}
                </div>
              </div>

              {/* Tags */}
              {opportunity.contact?.tags && opportunity.contact.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {opportunity.contact.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Contact Notes */}
              {opportunity.contact?.notes && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Contact Notes</Label>
                    <p className="text-sm bg-muted p-3 rounded-md">{opportunity.contact.notes}</p>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Activity tracking coming soon</p>
              <p className="text-xs">Future updates will show interaction history, tasks, and follow-ups</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}