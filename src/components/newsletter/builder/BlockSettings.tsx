import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { NewsletterBlock } from './types';

interface BlockSettingsProps {
  block: NewsletterBlock;
  onUpdate: (props: Record<string, any>) => void;
}

export function BlockSettings({ block, onUpdate }: BlockSettingsProps) {
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
          <SettingGroup label="Content"><Textarea value={p.html} onChange={(e) => onUpdate({ html: e.target.value })} rows={4} /></SettingGroup>
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
          <SettingGroup label="Image URL"><Input value={p.src} onChange={(e) => onUpdate({ src: e.target.value })} placeholder="https://..." /></SettingGroup>
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
    case 'market_data':
      return (
        <div className="space-y-4">
          <SettingGroup label="Header Text"><Input value={p.headerText} onChange={(e) => onUpdate({ headerText: e.target.value })} /></SettingGroup>
          <SettingGroup label="Style">
            <Select value={p.style} onValueChange={(v) => onUpdate({ style: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cards">Cards</SelectItem>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="minimal">Minimal</SelectItem>
              </SelectContent>
            </Select>
          </SettingGroup>
          <p className="text-xs text-muted-foreground">Metrics are auto-populated per contact ZIP code at send time.</p>
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
