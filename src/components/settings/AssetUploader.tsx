/**
 * AssetUploader — tiny shared uploader for brand assets (headshot / logos).
 * Writes to the `agent-assets` Supabase bucket at `<userId>/<fileKey>.<ext>`
 * (deterministic path → easy to overwrite). Returns the public URL via
 * `onChange`. The caller then persists that URL on
 * `agent_marketing_settings`.
 */

import { useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AssetUploaderProps {
  label: string;
  /** Current public URL — passed back as '' when the user clears. */
  value: string;
  onChange: (url: string) => void;
  userId: string;
  /** Used as the file basename so the same field always overwrites itself. */
  fileKey: string;
  /** Visual aspect for the preview thumbnail. Square by default. */
  shape?: 'square' | 'wide';
  help?: string;
}

export function AssetUploader({
  label,
  value,
  onChange,
  userId,
  fileKey,
  shape = 'square',
  help,
}: AssetUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const filePath = `${userId}/${fileKey}.${ext}`;
      // Clear any older extension at this fileKey to keep storage tidy.
      await Promise.allSettled(
        ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']
          .filter((x) => x !== ext)
          .map((x) => supabase.storage.from('agent-assets').remove([`${userId}/${fileKey}.${x}`])),
      );
      const { error: upErr } = await supabase.storage
        .from('agent-assets')
        .upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('agent-assets').getPublicUrl(filePath);
      // Cache-bust so the new image shows immediately.
      onChange(`${publicUrl}?t=${Date.now()}`);
      toast({ title: `${label} uploaded` });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-reop-dark-blue">{label}</label>
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative">
            <img
              src={value}
              alt={label}
              className={cn(
                'object-cover rounded-md border border-border bg-card',
                shape === 'square' ? 'h-16 w-16' : 'h-12 w-28',
              )}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground h-4 w-4 flex items-center justify-center"
              title="Remove"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ) : (
          <div
            className={cn(
              'rounded-md border border-dashed border-border bg-muted/40 flex items-center justify-center text-muted-foreground',
              shape === 'square' ? 'h-16 w-16' : 'h-12 w-28',
            )}
          >
            <Upload className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 flex flex-col gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleUpload}
            disabled={uploading}
            className="text-xs file:mr-2 file:rounded-md file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-xs file:font-medium hover:file:bg-muted disabled:opacity-60"
          />
          {uploading && (
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
            </span>
          )}
          {help && <span className="text-[11px] text-muted-foreground">{help}</span>}
        </div>
      </div>
    </div>
  );
}
