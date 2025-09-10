import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Phone, MessageSquare, Mail, Calendar, FileText, CheckSquare, Clock } from 'lucide-react';
import { Contact } from '@/hooks/useContacts';
import { useContactActivities, ContactActivity } from '@/hooks/useContactActivities';
import { AddActivityForm } from './AddActivityForm';
import { formatDistanceToNow } from 'date-fns';

interface ContactActivitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
}

const getActivityIcon = (type: ContactActivity['activity_type']) => {
  switch (type) {
    case 'call': return <Phone className="h-4 w-4" />;
    case 'text': return <MessageSquare className="h-4 w-4" />;
    case 'email': return <Mail className="h-4 w-4" />;
    case 'meeting': return <Calendar className="h-4 w-4" />;
    case 'note': return <FileText className="h-4 w-4" />;
    case 'task': return <CheckSquare className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

const getActivityColor = (type: ContactActivity['activity_type']) => {
  switch (type) {
    case 'call': return 'bg-blue-500';
    case 'text': return 'bg-green-500';
    case 'email': return 'bg-purple-500';
    case 'meeting': return 'bg-orange-500';
    case 'note': return 'bg-gray-500';
    case 'task': return 'bg-yellow-500';
    default: return 'bg-gray-500';
  }
};

export const ContactActivitiesDialog: React.FC<ContactActivitiesDialogProps> = ({
  open,
  onOpenChange,
  contact,
}) => {
  const { activities, loading, fetchActivities, addActivity } = useContactActivities(contact.id);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (open && contact.id) {
      fetchActivities();
    }
  }, [open, contact.id, fetchActivities]);

  const handleAddActivity = async (activityData: any) => {
    try {
      await addActivity(activityData);
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding activity:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Activities - {contact.first_name} {contact.last_name}</span>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Activity
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Contact Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Activities</p>
                <p className="text-2xl font-bold">{contact.activity_count || 0}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Activity</p>
                <p className="text-sm">
                  {contact.last_activity_date 
                    ? formatDistanceToNow(new Date(contact.last_activity_date), { addSuffix: true })
                    : 'Never'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p className="text-sm">{contact.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-sm">{contact.email || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Activities Timeline */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Loading activities...</div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No activities recorded yet. Add your first activity to get started.
              </div>
            ) : (
              activities.map((activity) => (
                <Card key={activity.id} className="border-l-4" style={{ borderLeftColor: getActivityColor(activity.activity_type).replace('bg-', '') }}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full text-white ${getActivityColor(activity.activity_type)}`}>
                          {getActivityIcon(activity.activity_type)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {activity.activity_type}
                            </Badge>
                            {activity.duration_minutes && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {activity.duration_minutes}m
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.activity_date), { addSuffix: true })} • 
                            {new Date(activity.activity_date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {activity.outcome && (
                      <div className="mt-3">
                        <p className="text-sm font-medium">Outcome:</p>
                        <p className="text-sm text-muted-foreground">{activity.outcome}</p>
                      </div>
                    )}
                    
                    {activity.notes && (
                      <div className="mt-3">
                        <p className="text-sm font-medium">Notes:</p>
                        <p className="text-sm text-muted-foreground">{activity.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Add Activity Form */}
        <AddActivityForm
          open={showAddForm}
          onOpenChange={setShowAddForm}
          onSubmit={handleAddActivity}
          contactName={`${contact.first_name} ${contact.last_name}`}
        />
      </DialogContent>
    </Dialog>
  );
};