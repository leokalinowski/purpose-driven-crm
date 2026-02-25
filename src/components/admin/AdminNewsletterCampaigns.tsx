import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, ChevronDown, ChevronRight, User, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AdminCampaign } from '@/hooks/useAdminNewsletter';

interface Props {
  campaigns: AdminCampaign[];
}

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  sent: 'default',
  completed: 'default',
  sending: 'secondary',
  draft: 'outline',
  pending: 'outline',
  running: 'secondary',
  failed: 'destructive',
};

export function AdminNewsletterCampaigns({ campaigns }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const downloadCSV = () => {
    const headers = ['Campaign', 'Agent', 'Status', 'Recipients', 'Open Rate', 'Click Rate', 'Date', 'Source'];
    const rows = campaigns.map(c => [
      c.campaign_name,
      c.agent_name || '',
      c.status || '',
      c.recipient_count ?? '',
      c.open_rate != null ? `${c.open_rate}%` : '',
      c.click_through_rate != null ? `${c.click_through_rate}%` : '',
      c.send_date || c.created_at,
      c.source,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Campaign History</CardTitle>
            <CardDescription>All newsletter campaigns across template sends and legacy runs</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={downloadCSV} disabled={campaigns.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No campaigns found.</div>
        ) : (
          <div className="space-y-2">
            {campaigns.map(c => {
              const isExpanded = expandedId === c.id;
              return (
                <div key={c.id} className="border rounded-lg">
                  <button
                    className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{c.campaign_name}</span>
                          <Badge variant={statusVariants[c.status || ''] || 'outline'} className="text-xs">
                            {c.status || 'unknown'}
                          </Badge>
                          {c.source === 'legacy' && (
                            <Badge variant="outline" className="text-xs">Legacy</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {c.agent_name && (
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{c.agent_name}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDistanceToNow(new Date(c.send_date || c.created_at))} ago
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm shrink-0 ml-4">
                      <div>{c.recipient_count ?? 0} recipients</div>
                      {c.open_rate != null && (
                        <div className="text-xs text-muted-foreground">
                          {c.open_rate.toFixed(1)}% open · {(c.click_through_rate ?? 0).toFixed(1)}% click
                        </div>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Recipients</div>
                          <div className="text-lg font-semibold">{c.recipient_count ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Open Rate</div>
                          <div className="text-lg font-semibold">{c.open_rate != null ? `${c.open_rate.toFixed(1)}%` : '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Click Rate</div>
                          <div className="text-lg font-semibold">{c.click_through_rate != null ? `${c.click_through_rate.toFixed(1)}%` : '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Source</div>
                          <div className="text-lg font-semibold capitalize">{c.source}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
