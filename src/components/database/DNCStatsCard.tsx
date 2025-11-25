import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, ShieldCheck, ShieldX, Clock, AlertTriangle, PhoneOff } from 'lucide-react';
import { DNCStats } from '@/hooks/useDNCStats';

interface DNCStatsCardProps {
  stats: DNCStats;
  loading: boolean;
  agentLabel?: string;
}

export const DNCStatsCard = ({ stats, loading, agentLabel }: DNCStatsCardProps) => {
  const dncPercentage = stats.totalContacts > 0 ? (stats.dncContacts / stats.totalContacts) * 100 : 0;
  const safePercentage = stats.totalContacts > 0 ? (stats.nonDncContacts / stats.totalContacts) * 100 : 0;
  const uncheckedPercentage = stats.totalContacts > 0 ? (stats.neverChecked / stats.totalContacts) * 100 : 0;
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Do Not Call (DNC) Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading DNC statistics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Do Not Call (DNC) Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
            <div className="text-sm text-muted-foreground">Total Contacts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">{stats.dncContacts}</div>
            <div className="text-sm text-muted-foreground">DNC Listed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.nonDncContacts}</div>
            <div className="text-sm text-muted-foreground">Safe to Call</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warning">{stats.neverChecked}</div>
            <div className="text-sm text-muted-foreground">Never Checked</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats.missingPhone}</div>
            <div className="text-sm text-muted-foreground">Missing Phone</div>
          </div>
        </div>

        {/* Safe to Call Percentage Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Safe to Call Rate</span>
            <span className="text-sm text-muted-foreground">{safePercentage.toFixed(1)}%</span>
          </div>
          <Progress value={safePercentage} className="h-2" />
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="destructive" className="flex items-center gap-1">
            <ShieldX className="h-3 w-3" />
            {stats.dncContacts} DNC Listed ({dncPercentage.toFixed(0)}%)
          </Badge>
          <Badge variant="default" className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            {stats.nonDncContacts} Safe ({safePercentage.toFixed(0)}%)
          </Badge>
          {stats.neverChecked > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {stats.neverChecked} Never Checked
            </Badge>
          )}
          {stats.missingPhone > 0 && (
            <Badge variant="outline" className="flex items-center gap-1 border-muted-foreground/30">
              <PhoneOff className="h-3 w-3" />
              {stats.missingPhone} Missing Phone Data
            </Badge>
          )}
          {stats.needsRecheck > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {stats.needsRecheck} Need Recheck
            </Badge>
          )}
        </div>

        {/* Last Check Info */}
        <div className="text-sm text-muted-foreground">
          Last DNC check: {formatDate(stats.lastChecked)}
        </div>
        
        {/* Info Banners */}
        <div className="space-y-2">
          {stats.missingPhone > 0 && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded border border-border">
              <div className="font-medium mb-1">📞 {stats.missingPhone} contacts missing phone numbers</div>
              <div>These contacts cannot be checked against the DNC list. Use the contact enrichment feature below to add missing phone numbers.</div>
            </div>
          )}
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            🔄 DNC checks run automatically on the 1st of each month. Manual checks can be run using the buttons above.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};