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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center p-2 sm:p-0">
            <div className="text-xl sm:text-2xl font-bold">{stats.totalContacts}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Total Contacts</div>
          </div>
          <div className="text-center p-2 sm:p-0">
            <div className="text-xl sm:text-2xl font-bold text-destructive">{stats.dncContacts}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">DNC Listed</div>
          </div>
          <div className="text-center p-2 sm:p-0 lg:col-span-1">
            <div className="text-xl sm:text-2xl font-bold text-primary">{stats.nonDncContacts}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Safe to Call</div>
            <div className="text-xs text-muted-foreground mt-1 hidden sm:block">(Checked & Not DNC)</div>
          </div>
          <div className="text-center p-2 sm:p-0">
            <div className="text-xl sm:text-2xl font-bold text-orange-600">{stats.neverChecked}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Never Checked</div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2">
          <Badge variant="destructive" className="flex items-center gap-1 justify-center sm:justify-start">
            <ShieldX className="h-3 w-3" />
            <span className="truncate">{stats.dncContacts} DNC Listed ({dncPercentage.toFixed(0)}%)</span>
          </Badge>
          <Badge variant="default" className="flex items-center gap-1 justify-center sm:justify-start">
            <ShieldCheck className="h-3 w-3" />
            <span className="truncate">{stats.nonDncContacts} Safe ({safePercentage.toFixed(0)}%)</span>
          </Badge>
          {stats.neverChecked > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1 justify-center sm:justify-start">
              <Clock className="h-3 w-3" />
              <span className="truncate">{stats.neverChecked} Never Checked</span>
            </Badge>
          )}
          {stats.missingPhone > 0 && (
            <Badge variant="outline" className="flex items-center gap-1 justify-center sm:justify-start border-muted-foreground/30">
              <PhoneOff className="h-3 w-3" />
              <span className="truncate">{stats.missingPhone} Missing Phone</span>
            </Badge>
          )}
          {stats.needsRecheck > 0 && (
            <Badge variant="outline" className="flex items-center gap-1 justify-center sm:justify-start">
              <AlertTriangle className="h-3 w-3" />
              <span className="truncate">{stats.needsRecheck} Need Recheck</span>
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
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded border border-border">
              <div className="font-medium mb-1 flex items-center gap-1">
                <PhoneOff className="h-3 w-3" />
                <span>{stats.missingPhone} contacts missing phone numbers</span>
              </div>
              <div className="text-xs">These contacts cannot be checked against the DNC list. Use enrichment to add missing phone numbers.</div>
            </div>
          )}
          {stats.neverChecked > 0 && (
            <div className="text-xs bg-yellow-500/10 p-2 sm:p-3 rounded border border-yellow-500/20">
              <div className="font-medium mb-1 text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span>{stats.neverChecked} contacts never checked</span>
              </div>
              <div className="text-muted-foreground">These contacts need DNC verification. Use "Run DNC Check" above.</div>
            </div>
          )}
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <Clock className="h-3 w-3 inline mr-1" />
            DNC checks run monthly. Manual checks available above.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};