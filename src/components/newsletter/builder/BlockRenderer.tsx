import { useDrag, useDrop } from 'react-dnd';
import { Trash2, Copy, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewsletterBlock, BlockType, BLOCK_DEFAULTS } from './types';
import { ChildPath } from './NewsletterBuilder';

interface BlockRendererProps {
  block: NewsletterBlock;
  index: number;
  isSelected: boolean;
  selectedChildPath: ChildPath | null;
  onSelect: () => void;
  onSelectChild: (path: ChildPath | null) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (from: number, to: number) => void;
  onUpdate: (props: Record<string, any>) => void;
  onUpdateChildren?: (children: NewsletterBlock[][]) => void;
  onDeleteChild?: (parentId: string, colIndex: number, childId: string) => void;
  onDuplicateChild?: (parentId: string, colIndex: number, childId: string) => void;
  totalBlocks: number;
}

export function BlockRenderer({ block, index, isSelected, selectedChildPath, onSelect, onSelectChild, onDelete, onDuplicate, onMove, onUpdate, onUpdateChildren, onDeleteChild, onDuplicateChild, totalBlocks }: BlockRendererProps) {
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: 'CANVAS_BLOCK',
    item: { index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }), [index]);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'CANVAS_BLOCK',
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        onMove(item.index, index);
        item.index = index;
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  }), [index, onMove]);

  return (
    <div
      ref={(node) => { preview(drop(node)); }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`group relative rounded-lg border transition-all cursor-pointer
        ${isDragging ? 'opacity-30' : ''}
        ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-border'}
        ${isOver ? 'border-t-2 border-t-primary' : ''}`}
    >
      {/* Toolbar */}
      <div className={`absolute -top-3 right-2 z-10 flex items-center gap-0.5 bg-background border rounded-md shadow-sm px-1
        ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
        <div ref={drag} className="cursor-grab p-1 hover:bg-muted rounded">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); if (index > 0) onMove(index, index - 1); }} disabled={index === 0}>
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); if (index < totalBlocks - 1) onMove(index, index + 1); }} disabled={index >= totalBlocks - 1}>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Block preview */}
      <div className="p-4">
        <BlockPreview
          block={block}
          onUpdateChildren={onUpdateChildren}
          selectedChildPath={selectedChildPath}
          onSelectChild={onSelectChild}
          onDeleteChild={onDeleteChild}
          onDuplicateChild={onDuplicateChild}
        />
      </div>
    </div>
  );
}

// Column drop zone sub-component with interactive children
function ColumnDropZone({
  children,
  columnIndex,
  parentId,
  onAddBlock,
  selectedChildPath,
  onSelectChild,
  onDeleteChild,
  onDuplicateChild,
}: {
  children: NewsletterBlock[];
  columnIndex: number;
  parentId: string;
  onAddBlock: (colIndex: number, blockType: BlockType) => void;
  selectedChildPath?: ChildPath | null;
  onSelectChild?: (path: ChildPath | null) => void;
  onDeleteChild?: (parentId: string, colIndex: number, childId: string) => void;
  onDuplicateChild?: (parentId: string, colIndex: number, childId: string) => void;
}) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'BLOCK',
    drop: (item: { blockType: BlockType }, monitor) => {
      if (monitor.didDrop()) return;
      onAddBlock(columnIndex, item.blockType);
    },
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
  }), [columnIndex, onAddBlock]);

  return (
    <div
      ref={drop}
      className={`min-h-[60px] rounded border border-dashed p-2 transition-colors ${isOver ? 'bg-primary/10 border-primary' : 'border-border'}`}
    >
      {children.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Drop blocks here</p>
      ) : (
        <div className="space-y-1">
          {children.map((child) => {
            const isChildSelected = selectedChildPath?.parentId === parentId
              && selectedChildPath?.colIndex === columnIndex
              && selectedChildPath?.childId === child.id;
            return (
              <div
                key={child.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectChild?.({ parentId, colIndex: columnIndex, childId: child.id });
                }}
                className={`group/child relative rounded border bg-background p-2 cursor-pointer transition-all
                  ${isChildSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
              >
                {/* Child toolbar */}
                <div className={`absolute -top-2 right-1 z-10 flex items-center gap-0.5 bg-background border rounded shadow-sm px-0.5
                  ${isChildSelected ? 'opacity-100' : 'opacity-0 group-hover/child:opacity-100'} transition-opacity`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => { e.stopPropagation(); onDuplicateChild?.(parentId, columnIndex, child.id); }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDeleteChild?.(parentId, columnIndex, child.id); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <BlockPreview block={child} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


const SOCIAL_PLATFORMS: Record<string, string> = {
  facebook: '📘', instagram: '📷', linkedin: '💼', twitter: '🐦', youtube: '▶️', tiktok: '🎵',
};

function convertNewlines(html: string): string {
  if (/<(p|div|br|ul|ol|li|h[1-6])\b/i.test(html)) return html;
  return html.replace(/\n/g, '<br />');
}

function BlockPreview({
  block,
  onUpdateChildren,
  selectedChildPath,
  onSelectChild,
  onDeleteChild,
  onDuplicateChild,
}: {
  block: NewsletterBlock;
  onUpdateChildren?: (children: NewsletterBlock[][]) => void;
  selectedChildPath?: ChildPath | null;
  onSelectChild?: (path: ChildPath | null) => void;
  onDeleteChild?: (parentId: string, colIndex: number, childId: string) => void;
  onDuplicateChild?: (parentId: string, colIndex: number, childId: string) => void;
}) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.props.level || 2}` as keyof JSX.IntrinsicElements;
      const sizes: Record<number, string> = { 1: 'text-3xl', 2: 'text-2xl', 3: 'text-xl', 4: 'text-lg' };
      return (
        <Tag
          className={`${sizes[block.props.level || 2]} font-bold`}
          style={{ textAlign: block.props.align, color: block.props.color }}
        >
          {block.props.text}
        </Tag>
      );
    }
    case 'text':
      return (
        <div
          className="max-w-none"
          style={{ textAlign: block.props.align, color: block.props.color, fontSize: block.props.fontSize }}
          dangerouslySetInnerHTML={{ __html: convertNewlines(block.props.html || '') }}
        />
      );
    case 'image':
      return block.props.src ? (
        <div style={{ textAlign: block.props.align }}>
          <img src={block.props.src} alt={block.props.alt} className="max-w-full inline-block" style={{ width: block.props.width, borderRadius: block.props.borderRadius }} />
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 bg-muted rounded-lg border-2 border-dashed">
          <p className="text-sm text-muted-foreground">Add an image in settings →</p>
        </div>
      );
    case 'button':
      return (
        <div style={{ textAlign: block.props.align }}>
          <span
            className="inline-block px-7 py-3 font-semibold text-base cursor-default"
            style={{
              backgroundColor: block.props.backgroundColor,
              color: block.props.textColor,
              borderRadius: block.props.borderRadius,
              width: block.props.fullWidth ? '100%' : 'auto',
              textAlign: 'center',
            }}
          >
            {block.props.text}
          </span>
        </div>
      );
    case 'divider':
      return <hr style={{ borderTop: `${block.props.thickness}px ${block.props.style} ${block.props.color}`, width: block.props.width }} />;
    case 'spacer':
      return <div className="flex items-center justify-center" style={{ height: block.props.height }}>
        <span className="text-xs text-muted-foreground">{block.props.height}px</span>
      </div>;

    case 'listings': {
      const listings = block.props.listings || [];
      const isGrid = block.props.style === 'grid';
      if (listings.length === 0) {
        return (
          <div className="border border-border rounded-lg p-6 text-center">
            <p className="font-semibold text-foreground text-sm">Featured Listings</p>
            <p className="text-xs text-muted-foreground mt-1">Paste listing URLs in settings to add properties →</p>
          </div>
        );
      }
      return (
        <div className="p-1">
          <p className="font-semibold text-foreground text-sm mb-3">Featured Listings</p>
          <div className={isGrid ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
            {listings.map((l: any) => (
              <div key={l.id} className={`bg-card rounded-lg border border-border overflow-hidden ${isGrid ? '' : 'flex items-center gap-3'}`}>
                {l.image_url ? (
                  <img src={l.image_url} alt={l.address} className={`object-cover ${isGrid ? 'h-28 w-full' : 'h-20 w-24 shrink-0'}`} />
                ) : (
                  <div className={`bg-muted flex items-center justify-center text-muted-foreground text-xs ${isGrid ? 'h-28 w-full' : 'h-20 w-24 shrink-0'}`}>
                    No Image
                  </div>
                )}
                <div className="p-3 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{l.price}</p>
                  <p className="text-xs text-muted-foreground truncate mt-1">{l.address}</p>
                  {l.city && <p className="text-xs text-muted-foreground truncate">{l.city}</p>}
                  <p className="text-xs text-muted-foreground/70 mt-1">{l.beds} bed · {l.baths} bath · {l.sqft} sqft</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'agent_bio': {
      const bioFields = [
        ['showHeadshot', 'Headshot'],
        ['showLogo', 'Brokerage Logo'],
        ['showPhone', 'Phone'],
        ['showEmail', 'Email'],
        ['showLicense', 'License #'],
        ['showBrokerage', 'Brokerage Name'],
        ['showOfficeAddress', 'Office Address'],
        ['showOfficePhone', 'Office Phone'],
        ['showWebsite', 'Website'],
        ['showEqualHousing', 'Equal Housing Opportunity'],
      ];
      const enabled = bioFields.filter(([key]) => block.props[key] !== false);
      return (
        <div className="bg-muted rounded-lg p-4">
          <p className="font-semibold text-sm text-center mb-2">👤 Agent Bio & Compliance</p>
          <p className="text-xs text-muted-foreground text-center mb-3">Auto-populated from your profile at send time</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {enabled.map(([key, label]) => (
              <span key={key} className="text-xs bg-background border rounded-full px-2 py-0.5">✓ {label}</span>
            ))}
          </div>
        </div>
      );
    }
    case 'social_icons': {
      const links: { platform: string; url: string }[] = block.props.links || [];
      return (
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4" style={{ textAlign: block.props.align }}>
          {links.length > 0 ? (
            <div className="flex gap-3 justify-center flex-wrap">
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-1 bg-white dark:bg-purple-900/40 rounded-full px-3 py-1 border border-purple-100 dark:border-purple-700">
                  <span>{SOCIAL_PLATFORMS[link.platform] || '🔗'}</span>
                  <span className="text-xs font-medium capitalize">{link.platform}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="font-semibold text-purple-800 dark:text-purple-200 text-sm">🔗 Social Icons</p>
              <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">Add social links in settings →</p>
            </>
          )}
        </div>
      );
    }
    case 'columns': {
      const colCount = block.props.columns || 2;
      const cols = block.children || Array.from({ length: colCount }, () => []);

      const handleAddBlock = (colIndex: number, blockType: BlockType) => {
        if (!onUpdateChildren) return;
        const newBlock: NewsletterBlock = {
          id: crypto.randomUUID(),
          type: blockType,
          props: { ...BLOCK_DEFAULTS[blockType] },
        };
        const newChildren = cols.map((col, i) =>
          i === colIndex ? [...col, newBlock] : [...col]
        );
        onUpdateChildren(newChildren);
      };

      return (
        <div className="rounded-lg border border-dashed border-border p-2">
          <p className="text-xs text-muted-foreground text-center mb-2">{colCount}-Column Layout</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
            {cols.slice(0, colCount).map((col, i) => (
              <ColumnDropZone
                key={i}
                columnIndex={i}
                parentId={block.id}
                children={col}
                onAddBlock={handleAddBlock}
                selectedChildPath={selectedChildPath}
                onSelectChild={onSelectChild}
                onDeleteChild={onDeleteChild}
                onDuplicateChild={onDuplicateChild}
              />
            ))}
          </div>
        </div>
      );
    }
    case 'html_raw':
      return (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted px-3 py-1 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Raw HTML</span>
          </div>
          {block.props.html ? (
            <div className="p-3" dangerouslySetInnerHTML={{ __html: block.props.html }} />
          ) : (
            <div className="p-3 text-xs text-muted-foreground font-mono">{'<p>Custom HTML here</p>'}</div>
          )}
        </div>
      );
    default:
      return <div className="text-sm text-muted-foreground">[{block.type}]</div>;
  }
}
