/**
 * MetricoolAdminBulkConnect — admin-only one-shot widget that imports every
 * agent in `agent_marketing_settings` (with a `metricool_brand_id` set) into
 * the new `metricool_brands` table, using the admin's master Metricool
 * credentials.
 *
 * Why it exists: the legacy admin flow stored each agent's blog_id but
 * didn't pair it with API credentials. The new REST integration needs both.
 * Since one Metricool user manages many brands, the admin's master token
 * can authenticate calls for ALL agents — no need for per-agent paste.
 *
 * UX:
 *   1. Admin clicks "Preview" → dry-run shows what WOULD happen.
 *   2. Admin clicks "Import all" → real import; reports per-agent status.
 *   3. After success, agents land on /social-scheduler and find their
 *      Compose / Calendar / Analytics tabs already working.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ExternalLink,
  Eye, Loader2, ShieldCheck, Sparkles, XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const inputCls =
  'h-10 px-3 rounded-md border border-border bg-background text-sm focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition w-full';

interface ResultEntry {
  agent_id: string;
  agent_name: string;
  blog_id: number;
  status: 'imported' | 'skipped' | 'failed';
  reason?: string;
  networks: string[];
}

interface BulkResponse {
  ok: boolean;
  error?: string;
  detail?: unknown;
  summary?: {
    totalCandidates: number;
    imported: number;
    skipped: number;
    failed: number;
    dry_run: boolean;
  };
  results?: ResultEntry[];
  accessible_blog_count?: number;
}

export function MetricoolAdminBulkConnect() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [userToken, setUserToken] = useState('');
  const [metricoolUserId, setMetricoolUserId] = useState('');
  const [running, setRunning] = useState<'preview' | 'import' | null>(null);
  const [response, setResponse] = useState<BulkResponse | null>(null);

  const run = async (dryRun: boolean) => {
    if (!userToken.trim() || !metricoolUserId.trim()) {
      toast({ title: 'Both fields required', variant: 'destructive' });
      return;
    }
    setRunning(dryRun ? 'preview' : 'import');
    setResponse(null);
    try {
      const { data, error } = await supabase.functions.invoke<BulkResponse>(
        'metricool-admin-bulk-connect',
        { body: { user_token: userToken.trim(), user_id_metricool: metricoolUserId.trim(), dry_run: dryRun } },
      );
      if (error) {
        setResponse({ ok: false, error: error.message });
        return;
      }
      setResponse(data ?? { ok: false, error: 'Empty response' });
      if (data?.ok && !dryRun && data.summary) {
        toast({
          title: 'Import complete',
          description: `${data.summary.imported} imported · ${data.summary.skipped} skipped · ${data.summary.failed} failed.`,
        });
        // Clear secrets from memory once import is done.
        setUserToken('');
      }
    } catch (err) {
      setResponse({ ok: false, error: err instanceof Error ? err.message : 'Bulk connect failed' });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden">
      {/* Header — collapsible to keep the page tidy */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-amber-50/60 transition"
        aria-expanded={expanded}
      >
        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Bulk-connect existing Metricool brands</h3>
            <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
              Admin only · one-time
            </span>
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
            Wires every agent that already has a brand_id in their marketing settings into the new REST integration.
            Paste your master Metricool token + User ID once, run the import, done.
          </p>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-2" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-2" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-amber-200/60">
          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="bulk-token" className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1 block">
                Master User Token
              </Label>
              <Input
                id="bulk-token"
                type="password"
                autoComplete="off"
                className={inputCls}
                placeholder="X-Mc-Auth value from app.metricool.com → User Settings → API access"
                value={userToken}
                onChange={(e) => setUserToken(e.target.value)}
                disabled={running != null}
              />
            </div>
            <div>
              <Label htmlFor="bulk-userid" className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1 block">
                Master User ID
              </Label>
              <Input
                id="bulk-userid"
                inputMode="numeric"
                pattern="[0-9]*"
                className={inputCls}
                placeholder="123456"
                value={metricoolUserId}
                onChange={(e) => setMetricoolUserId(e.target.value.replace(/\D/g, ''))}
                disabled={running != null}
              />
            </div>
          </div>

          <p className="text-[11.5px] text-muted-foreground leading-snug">
            <a
              href="https://app.metricool.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Open Metricool <ExternalLink className="w-3 h-3" />
            </a>
            {' '}→ user-icon → User Settings → API access. Token + User ID are at the top.
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => run(true)}
              disabled={running != null || !userToken || !metricoolUserId}
              className="gap-1.5"
            >
              {running === 'preview' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              Preview (dry run)
            </Button>
            <Button
              onClick={() => run(false)}
              disabled={running != null || !userToken || !metricoolUserId}
              className="gap-1.5"
            >
              {running === 'import' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Import all
            </Button>
          </div>

          {/* Result */}
          {response && (
            <div className="space-y-3">
              {!response.ok && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    {response.error ?? 'Bulk connect failed'}
                    {response.detail != null && (
                      <pre className="text-[10.5px] mt-2 whitespace-pre-wrap break-words opacity-80">
                        {typeof response.detail === 'string' ? response.detail : JSON.stringify(response.detail, null, 2)}
                      </pre>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {response.ok && response.summary && (
                <div className="rounded-md border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <span className="text-sm font-semibold text-foreground">
                      {response.summary.dry_run ? 'Preview results' : 'Import results'}
                    </span>
                    <div className="flex gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                        {response.summary.imported} imported
                      </span>
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                        {response.summary.skipped} skipped
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                        {response.summary.failed} failed
                      </span>
                    </div>
                  </div>
                  {response.accessible_blog_count != null && (
                    <p className="text-[11.5px] text-muted-foreground mb-2">
                      Master user has access to {response.accessible_blog_count} brand{response.accessible_blog_count === 1 ? '' : 's'} on Metricool.
                    </p>
                  )}
                  <div className="space-y-1">
                    {(response.results ?? []).map((r) => (
                      <ResultRow key={r.agent_id} entry={r} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ entry }: { entry: ResultEntry }) {
  const Icon = entry.status === 'imported' ? CheckCircle2 : entry.status === 'skipped' ? ChevronRight : XCircle;
  return (
    <div className="flex items-start gap-2 py-1.5 border-t border-border first:border-t-0">
      <Icon className={cn(
        'w-4 h-4 mt-0.5 flex-shrink-0',
        entry.status === 'imported' ? 'text-emerald-600'
          : entry.status === 'skipped' ? 'text-muted-foreground'
            : 'text-rose-600',
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12.5px] font-semibold text-foreground">{entry.agent_name}</span>
          <span className="text-[11px] text-muted-foreground">blog #{entry.blog_id}</span>
          {entry.networks.length > 0 && (
            <span className="text-[10.5px] text-muted-foreground">
              · {entry.networks.length} network{entry.networks.length === 1 ? '' : 's'}: {entry.networks.join(', ')}
            </span>
          )}
        </div>
        {entry.reason && (
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{entry.reason}</p>
        )}
      </div>
    </div>
  );
}
