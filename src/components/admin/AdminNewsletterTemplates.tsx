import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Send, FileText, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AdminTemplate, AgentProfile } from '@/hooks/useAdminNewsletter';
import { SendSchedulePanel } from '@/components/newsletter/builder/SendSchedulePanel';

interface Props {
  templates: AdminTemplate[];
  agents: AgentProfile[];
}

export function AdminNewsletterTemplates({ templates, agents }: Props) {
  const [filterAgentId, setFilterAgentId] = useState<string>('all');
  const [sendTemplate, setSendTemplate] = useState<AdminTemplate | null>(null);

  const filtered = filterAgentId === 'all'
    ? templates
    : templates.filter(t => t.agent_id === filterAgentId);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Templates</CardTitle>
              <CardDescription>Cross-agent view of newsletter templates</CardDescription>
            </div>
            <Select value={filterAgentId} onValueChange={setFilterAgentId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filter by agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.user_id} value={a.user_id}>
                    {`${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No templates found</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map(t => (
                <Card key={t.id} className="overflow-hidden">
                  <div className="h-32 bg-muted flex items-center justify-center text-muted-foreground text-sm">
                    {t.thumbnail_url ? (
                      <img src={t.thumbnail_url} alt={t.name} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="h-10 w-10 opacity-30" />
                    )}
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {t.agent_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(t.updated_at))} ago
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-xs">
                        {t.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(`/newsletter?template=${t.id}`, '_blank')}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => setSendTemplate(t)}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Send
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {sendTemplate && (
        <SendSchedulePanel
          open={!!sendTemplate}
          onClose={() => setSendTemplate(null)}
          templateId={sendTemplate.id}
          templateName={sendTemplate.name}
        />
      )}
    </>
  );
}
