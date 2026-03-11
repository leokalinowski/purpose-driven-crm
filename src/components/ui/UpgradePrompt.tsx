import { Lock, ArrowUpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface UpgradePromptProps {
  featureName: string;
  requiredTier: string;
  currentTier: string | null;
  description?: string;
}

const TIER_LABELS: Record<string, string> = {
  core: 'Core',
  managed: 'Managed',
  agent: 'Agent (DFY)',
  admin: 'Admin',
  editor: 'Editor',
};

export function UpgradePrompt({ featureName, requiredTier, currentTier, description }: UpgradePromptProps) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">{featureName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {description || `This feature is available on the ${TIER_LABELS[requiredTier] || requiredTier} plan and above.`}
          </p>

          <div className="flex items-center justify-center gap-3">
            <Badge variant="outline" className="text-sm">
              Your plan: {TIER_LABELS[currentTier ?? ''] || 'None'}
            </Badge>
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
            <Badge className="text-sm bg-primary">
              Required: {TIER_LABELS[requiredTier] || requiredTier}
            </Badge>
          </div>

          <Button className="mt-2" onClick={() => navigate('/pricing')}>
            View Upgrade Options
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
