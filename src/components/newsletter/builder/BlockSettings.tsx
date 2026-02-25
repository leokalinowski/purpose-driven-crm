import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

import { Upload, Loader2, Plus, X, Link, Trash2 } from 'lucide-react';
import { NewsletterBlock, GlobalStyles, ListingItem } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface BlockSettingsProps {
  block: NewsletterBlock | null;
  onUpdate: (props: Record<string, any>) => void;
  globalStyles?: GlobalStyles;
  onUpdateGlobalStyles?: (styles: Partial<GlobalStyles>) => void;
}


const SOCIAL_PLATFORM_OPTIONS = [
  'facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok',
];

export function BlockSettings({ block, onUpdate, globalStyles, onUpdateGlobalStyles }: BlockSettingsProps) {
  if (!block) {
    return <GlobalStylesEditor styles={globalStyles} onUpdate={onUpdateGlobalStyles} />;
  }

  const p = block.props;

  switch (block.type) {
    case 'heading':
      return (
        <div className="space-y-4">
          <SettingGroup label="Text"><Input value={p.text} onChange={(e) => onUpdate({ text: e.target.value })} /></SettingGroup>
          <SettingGroup label="Level">
            <Select value={String(p.level)} onValueChange={(v) => onUpdate({ level: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1,2,3,4].map(l => <SelectItem key={l} value={String(l)}>H{l}</SelectItem>)}</SelectContent>
            </Select>
          </SettingGroup>
          <AlignSetting value={p.align} onChange={(v) => onUpdate({ align: v })} />
          <ColorSetting label="Color" value={p.color} onChange={(v) => onUpdate({ color: v })} />
          <SettingGroup label="Font Family"><Input value={p.fontFamily} onChange={(e) => onUpdate({ fontFamily: e.target.value })} /></SettingGroup>
        </div>
      );
    case 'text':
      return (
        <div className="space-y-4">
          <SettingGroup label="Content"><Textarea value={p.html} onChange={(e) => onUpdate({ html: e.target.value })} rows={6} /></SettingGroup>
          <AlignSetting value={p.align} onChange={(v) => onUpdate({ align: v })} />
          <ColorSetting label="Color" value={p.color} onChange={(v) => onUpdate({ color: v })} />
          <SettingGroup label="Font Size">
            <div className="flex items-center gap-3">
              <Slider value={[p.fontSize]} min={12} max={24} step={1} onValueChange={([v]) => onUpdate({ fontSize: v })} className="flex-1" />
              <span className="text-xs w-8 text-right">{p.fontSize}px</span>
            </div>
          </SettingGroup>
        </div>
      );
    case 'image':
      return (
        <div className="space-y-4">
          <ImageUploadSetting src={p.src} onUpdate={onUpdate} />
          <SettingGroup label="Alt Text"><Input value={p.alt} onChange={(e) => onUpdate({ alt: e.target.value })} /></SettingGroup>
          <SettingGroup label="Width"><Input value={p.width} onChange={(e) => onUpdate({ width: e.target.value })} placeholder="100% or 300px" /></SettingGroup>
          <AlignSetting value={p.align} onChange={(v) => onUpdate({ align: v })} />
          <SettingGroup label="Link URL"><Input value={p.linkUrl} onChange={(e) => onUpdate({ linkUrl: e.target.value })} placeholder="https://..." /></SettingGroup>
          <SettingGroup label="Border Radius">
            <Slider value={[p.borderRadius]} min={0} max={24} step={1} onValueChange={([v]) => onUpdate({ borderRadius: v })} />
          </SettingGroup>
        </div>
      );
    case 'button':
      return (
        <div className="space-y-4">
          <SettingGroup label="Text"><Input value={p.text} onChange={(e) => onUpdate({ text: e.target.value })} /></SettingGroup>
          <SettingGroup label="URL"><Input value={p.url} onChange={(e) => onUpdate({ url: e.target.value })} /></SettingGroup>
          <ColorSetting label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
          <ColorSetting label="Text Color" value={p.textColor} onChange={(v) => onUpdate({ textColor: v })} />
          <AlignSetting value={p.align} onChange={(v) => onUpdate({ align: v })} />
          <SettingGroup label="Border Radius">
            <Slider value={[p.borderRadius]} min={0} max={24} step={1} onValueChange={([v]) => onUpdate({ borderRadius: v })} />
          </SettingGroup>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Full Width</Label>
            <Switch checked={p.fullWidth} onCheckedChange={(v) => onUpdate({ fullWidth: v })} />
          </div>
        </div>
      );
    case 'divider':
      return (
        <div className="space-y-4">
          <ColorSetting label="Color" value={p.color} onChange={(v) => onUpdate({ color: v })} />
          <SettingGroup label="Thickness">
            <Slider value={[p.thickness]} min={1} max={6} step={1} onValueChange={([v]) => onUpdate({ thickness: v })} />
          </SettingGroup>
          <SettingGroup label="Style">
            <Select value={p.style} onValueChange={(v) => onUpdate({ style: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="dashed">Dashed</SelectItem>
                <SelectItem value="dotted">Dotted</SelectItem>
              </SelectContent>
            </Select>
          </SettingGroup>
        </div>
      );
    case 'spacer':
      return (
        <div className="space-y-4">
          <SettingGroup label="Height">
            <div className="flex items-center gap-3">
              <Slider value={[p.height]} min={8} max={120} step={4} onValueChange={([v]) => onUpdate({ height: v })} className="flex-1" />
              <span className="text-xs w-10 text-right">{p.height}px</span>
            </div>
          </SettingGroup>
        </div>
      );
    case 'columns':
      return (
        <div className="space-y-4">
          <SettingGroup label="Number of Columns">
            <Select value={String(p.columns || 2)} onValueChange={(v) => onUpdate({ columns: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 Columns</SelectItem>
                <SelectItem value="3">3 Columns</SelectItem>
              </SelectContent>
            </Select>
          </SettingGroup>
          <SettingGroup label="Gap">
            <div className="flex items-center gap-3">
              <Slider value={[p.gap || 16]} min={0} max={32} step={4} onValueChange={([v]) => onUpdate({ gap: v })} className="flex-1" />
              <span className="text-xs w-8 text-right">{p.gap || 16}px</span>
            </div>
          </SettingGroup>
          <p className="text-xs text-muted-foreground">Drag content blocks into each column on the canvas.</p>
        </div>
      );


    case 'agent_bio':
      return (
        <div className="space-y-4">
          <SettingGroup label="Layout">
            <Select value={p.layout} onValueChange={(v) => onUpdate({ layout: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="horizontal">Horizontal</SelectItem>
                <SelectItem value="vertical">Vertical</SelectItem>
              </SelectContent>
            </Select>
          </SettingGroup>
          {[['showHeadshot', 'Show Headshot'], ['showLogo', 'Show Logo'], ['showPhone', 'Show Phone'], ['showEmail', 'Show Email']].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-xs">{label}</Label>
              <Switch checked={p[key]} onCheckedChange={(v) => onUpdate({ [key]: v })} />
            </div>
          ))}
        </div>
      );
    case 'social_icons': {
      const links: { platform: string; url: string }[] = p.links || [];
      const addLink = () => onUpdate({ links: [...links, { platform: 'facebook', url: '' }] });
      const removeLink = (i: number) => onUpdate({ links: links.filter((_, idx) => idx !== i) });
      const updateLink = (i: number, field: string, value: string) => {
        const updated = links.map((l, idx) => idx === i ? { ...l, [field]: value } : l);
        onUpdate({ links: updated });
      };
      return (
        <div className="space-y-4">
          <AlignSetting value={p.align} onChange={(v) => onUpdate({ align: v })} />
          <SettingGroup label="Icon Size">
            <div className="flex items-center gap-3">
              <Slider value={[p.iconSize]} min={20} max={48} step={2} onValueChange={([v]) => onUpdate({ iconSize: v })} className="flex-1" />
              <span className="text-xs w-8 text-right">{p.iconSize}px</span>
            </div>
          </SettingGroup>
          <SettingGroup label="Social Links">
            <div className="space-y-2">
              {links.map((link, i) => (
                <div key={i} className="flex gap-1.5 items-start">
                  <Select value={link.platform} onValueChange={(v) => updateLink(i, 'platform', v)}>
                    <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SOCIAL_PLATFORM_OPTIONS.map(p => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={link.url}
                    onChange={(e) => updateLink(i, 'url', e.target.value)}
                    placeholder="https://..."
                    className="h-8 text-xs flex-1"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeLink(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={addLink}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Link
              </Button>
            </div>
          </SettingGroup>
        </div>
      );
    }
    case 'listings':
      return <ListingsSettings props={p} onUpdate={onUpdate} />;
    case 'html_raw':
      return (
        <div className="space-y-4">
          <SettingGroup label="HTML Code"><Textarea value={p.html} onChange={(e) => onUpdate({ html: e.target.value })} rows={8} className="font-mono text-xs" /></SettingGroup>
        </div>
      );
    default:
      return <p className="text-sm text-muted-foreground">No settings for this block type.</p>;
  }
}

function ListingsSettings({ props: p, onUpdate }: { props: Record<string, any>; onUpdate: (p: Record<string, any>) => void }) {
  const [url, setUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const { toast } = useToast();
  const listings: ListingItem[] = p.listings || [];

  const handleAddListing = async () => {
    if (!url.trim()) return;
    if (listings.length >= 6) {
      toast({ title: 'Maximum 6 listings', variant: 'destructive' });
      return;
    }

    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-listing', {
        body: { url: url.trim() },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to scrape listing');

      const newListing: ListingItem = {
        id: crypto.randomUUID(),
        url: url.trim(),
        image_url: data.listing.image_url || '',
        price: data.listing.price,
        address: data.listing.address,
        city: data.listing.city || '',
        beds: data.listing.beds || 0,
        baths: data.listing.baths || 0,
        sqft: data.listing.sqft || 'N/A',
        status: 'loaded',
      };

      onUpdate({ listings: [...listings, newListing] });
      setUrl('');
      toast({ title: 'Listing added!' });
    } catch (err: any) {
      toast({ title: 'Failed to scrape listing', description: err.message, variant: 'destructive' });
    } finally {
      setScraping(false);
    }
  };

  const removeListing = (id: string) => {
    onUpdate({ listings: listings.filter(l => l.id !== id) });
  };

  return (
    <div className="space-y-4">
      <SettingGroup label="Style">
        <Select value={p.style || 'grid'} onValueChange={(v) => onUpdate({ style: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">Grid</SelectItem>
            <SelectItem value="list">List</SelectItem>
          </SelectContent>
        </Select>
      </SettingGroup>

      <SettingGroup label="Add Listing URL">
        <div className="flex gap-1.5">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://zillow.com/homedetails/..."
            className="flex-1 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && handleAddListing()}
            disabled={scraping}
          />
          <Button size="sm" onClick={handleAddListing} disabled={scraping || !url.trim()}>
            {scraping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Paste a Zillow, Homes.com, Realtor.com, or Redfin URL</p>
      </SettingGroup>

      {listings.length > 0 && (
        <SettingGroup label={`Listings (${listings.length}/6)`}>
          <div className="space-y-2">
            {listings.map((listing) => (
              <div key={listing.id} className="flex items-start gap-2 p-2 border rounded-md bg-muted/50">
                {listing.image_url && (
                  <img src={listing.image_url} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{listing.price}</p>
                  <p className="text-xs text-muted-foreground truncate">{listing.address}</p>
                  <p className="text-xs text-muted-foreground">{listing.beds}bd · {listing.baths}ba · {listing.sqft} sqft</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeListing(listing.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </SettingGroup>
      )}
    </div>
  );
}

function ImageUploadSetting({ src, onUpdate }: { src: string; onUpdate: (p: Record<string, any>) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('newsletter-assets').upload(path, file);
      if (error) throw error;

      const { data } = supabase.storage.from('newsletter-assets').getPublicUrl(path);
      onUpdate({ src: data.publicUrl });
      toast({ title: 'Image uploaded' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <SettingGroup label="Image">
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input value={src} onChange={(e) => onUpdate({ src: e.target.value })} placeholder="https://..." className="flex-1" />
          <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        {src && (
          <img src={src} alt="Preview" className="w-full max-h-32 object-contain rounded border bg-muted" />
        )}
      </div>
    </SettingGroup>
  );
}

function GlobalStylesEditor({ styles, onUpdate }: { styles?: GlobalStyles; onUpdate?: (s: Partial<GlobalStyles>) => void }) {
  if (!styles || !onUpdate) {
    return (
      <div className="text-center text-muted-foreground mt-8">
        <p className="text-sm font-medium">No block selected</p>
        <p className="text-xs mt-1">Click a block to edit its settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Global Styles</h3>
      <ColorSetting label="Background Color" value={styles.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <SettingGroup label="Content Width">
        <div className="flex items-center gap-3">
          <Slider value={[styles.contentWidth]} min={500} max={700} step={10} onValueChange={([v]) => onUpdate({ contentWidth: v })} className="flex-1" />
          <span className="text-xs w-12 text-right">{styles.contentWidth}px</span>
        </div>
      </SettingGroup>
      <SettingGroup label="Font Family">
        <Select value={styles.fontFamily} onValueChange={(v) => onUpdate({ fontFamily: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Georgia, serif">Georgia</SelectItem>
            <SelectItem value="Arial, sans-serif">Arial</SelectItem>
            <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
            <SelectItem value="'Times New Roman', serif">Times New Roman</SelectItem>
            <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
          </SelectContent>
        </Select>
      </SettingGroup>
      <ColorSetting label="Body Text Color" value={styles.bodyColor} onChange={(v) => onUpdate({ bodyColor: v })} />
    </div>
  );
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium">{label}</Label>{children}</div>;
}

function AlignSetting({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <SettingGroup label="Alignment">
      <div className="flex gap-1">
        {(['left', 'center', 'right'] as const).map(a => (
          <button
            key={a}
            onClick={() => onChange(a)}
            className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${value === a ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}
          >
            {a.charAt(0).toUpperCase() + a.slice(1)}
          </button>
        ))}
      </div>
    </SettingGroup>
  );
}

function ColorSetting({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <SettingGroup label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
      </div>
    </SettingGroup>
  );
}
