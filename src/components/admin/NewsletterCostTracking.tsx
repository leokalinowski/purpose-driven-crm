import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

export const NewsletterCostTracking: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Tracking</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Cost tracking feature will be available after the newsletter_cost_tracking table is created.
            This feature tracks Grok API usage, email sends, and associated costs.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
