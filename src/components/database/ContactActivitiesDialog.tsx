import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Phone, MessageSquare, Mail, Calendar, FileText, CheckSquare, Clock, Bot, Zap } from 'lucide-react';
import { Contact } from '@/hooks/useContacts';
import { useContactActivities, ContactActivity } from '@/hooks/useContactActivities';
import { AddActivityForm } from './AddActivityForm';
import { formatDistanceToNow } from 'date-fns';

interface ContactActivitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
}

const getActivityIcon = (type: ContactActivity['activity_type'], isSystemGenerated?: boolean) => {
  const Icon = isSystemGenerated ? Bot : (() => {
    switch (type) {
      case 'call': return Phone;
      case 'text': return MessageSquare;
      case 'email': return Mail;
      case 'meeting': return Calendar;
      case 'note': return FileText;
      case 'task': return CheckSquare;
      default: return FileText;
    }
  })();

  return <Icon className="h-4 w-4" />;
};

const getActivityColor = (type: ContactActivity['activity_type'], isSystemGenerated?: boolean, systemSource?: string) => {
  if (isSystemGenerated) {
    if (systemSource === 'spheresync') {
      return 'bg-primary';
    }
    if (systemSource === 'newsletter') {
      return 'bg-secondary';
    }
    return 'bg-muted-foreground';
  }
  
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
          <DialogTitle>
            Touchpoints - {contact.first_name} {contact.last_name}
          </DialogTitle>
        </DialogHeader>

        {/* Add Touchpoint Button - Better positioned */}
        <div className="flex justify-end mb-4">
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Touchpoint
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Contact Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Touchpoints</p>
                <p className="text-2xl font-bold">{contact.activity_count || 0}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Touchpoint</p>
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

          {/* Touchpoints Timeline */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Loading touchpoints...</div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No touchpoints recorded yet. Add your first touchpoint to get started.
              </div>
            ) : (
              activities.map((activity) => {
                const isSystemGenerated = activity.is_system_generated;
                const systemSource = activity.system_source;
                
                return (
                  <Card 
                    key={activity.id} 
                    className={`border-l-4 ${isSystemGenerated ? 'bg-muted/20' : ''}`} 
                    style={{ borderLeftColor: getActivityColor(activity.activity_type, isSystemGenerated, systemSource).replace('bg-', '') }}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full text-white ${getActivityColor(activity.activity_type, isSystemGenerated, systemSource)}`}>
                            {getActivityIcon(activity.activity_type, isSystemGenerated)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="capitalize">
                                {activity.activity_type}
                              </Badge>
                              {isSystemGenerated && (
                                <Badge variant="secondary" className="text-xs">
                                  <Zap className="h-3 w-3 mr-1" />
                                  {systemSource === 'spheresync' ? 'SphereSync' : 
                                   systemSource === 'newsletter' ? 'Newsletter' : 'System'}
                                </Badge>
                              )}
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
                          <p className="text-sm font-medium">{isSystemGenerated ? 'Details:' : 'Notes:'}</p>
                          <p className="text-sm text-muted-foreground">{activity.notes}</p>
                        </div>
                      )}
                      
                      {isSystemGenerated && activity.metadata && (
                        <div className="mt-3 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          {systemSource === 'spheresync' && (
                            <div>
                              Week {activity.metadata.week_number}, {activity.metadata.year}
                              {activity.metadata.completed && (
                                <span className="ml-2 text-green-600">✓ Completed</span>
                              )}
                            </div>
                          )}
                          {systemSource === 'newsletter' && activity.metadata.campaign_name && (
                            <div>Campaign: {activity.metadata.campaign_name}</div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Add Touchpoint Form */}
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