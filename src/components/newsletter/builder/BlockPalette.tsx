import { useDrag } from 'react-dnd';
import { Heading, Type, ImageIcon, MousePointerClick, Minus, MoveVertical, Columns2, Home, UserCircle, Code, Share2, Building } from 'lucide-react';
import { BlockType } from './types';

const PALETTE_ITEMS: { type: BlockType; label: string; icon: React.ElementType; description: string }[] = [
  { type: 'heading', label: 'Heading', icon: Heading, description: 'Title text H1-H4' },
  { type: 'text', label: 'Text', icon: Type, description: 'Paragraph content' },
  { type: 'image', label: 'Image', icon: ImageIcon, description: 'Photo or graphic' },
  { type: 'button', label: 'Button', icon: MousePointerClick, description: 'Call-to-action' },
  { type: 'divider', label: 'Divider', icon: Minus, description: 'Horizontal line' },
  { type: 'spacer', label: 'Spacer', icon: MoveVertical, description: 'Vertical space' },
  { type: 'columns', label: 'Columns', icon: Columns2, description: '2 or 3 columns' },
  
  { type: 'listings', label: 'Listings', icon: Building, description: 'Property showcase' },
  { type: 'agent_bio', label: 'Agent Bio', icon: UserCircle, description: 'Auto-filled profile' },
  { type: 'social_icons', label: 'Social Icons', icon: Share2, description: 'Social media links' },
  { type: 'html_raw', label: 'HTML', icon: Code, description: 'Custom HTML' },
];

function PaletteItem({ type, label, icon: Icon, description }: typeof PALETTE_ITEMS[number]) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'BLOCK',
    item: { blockType: type },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }));

  return (
    <div
      ref={drag}
      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all
        ${isDragging ? 'opacity-40 border-primary' : 'border-border hover:border-primary/50 hover:bg-accent/50'}`}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-none">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function BlockPalette() {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">Content Blocks</h3>
      {PALETTE_ITEMS.map((item) => (
        <PaletteItem key={item.type} {...item} />
      ))}
    </div>
  );
}
