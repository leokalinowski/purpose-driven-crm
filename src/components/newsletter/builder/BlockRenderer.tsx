import { useDrag, useDrop } from 'react-dnd';
import { Trash2, Copy, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewsletterBlock, BlockType, BLOCK_DEFAULTS } from './types';

interface BlockRendererProps {
  block: NewsletterBlock;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (from: number, to: number) => void;
  onUpdate: (props: Record<string, any>) => void;
  onUpdateChildren?: (children: NewsletterBlock[][]) => void;
  totalBlocks: number;
}

export function BlockRenderer({ block, index, isSelected, onSelect, onDelete, onDuplicate, onMove, onUpdate, onUpdateChildren, totalBlocks }: BlockRendererProps) {
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
        <BlockPreview block={block} onUpdateChildren={onUpdateChildren} />
      </div>
    </div>
  );
}

// Column drop zone sub-component
function ColumnDropZone({ children, columnIndex, onAddBlock }: { children: NewsletterBlock[]; columnIndex: number; onAddBlock: (colIndex: number, blockType: BlockType) => void }) {
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
          {children.map((child) => (
            <div key={child.id} className="rounded border border-border bg-background p-2">
              <BlockPreview block={child} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SAMPLE_METRICS = [
  { key: 'median_sale_price', label: 'Median Sale Price', value: '$425,000' },
  { key: 'active_listings', label: 'Active Listings', value: '142' },
  { key: 'days_on_market', label: 'Days on Market', value: '28' },
  { key: 'price_per_sqft', label: 'Price / Sq Ft', value: '$215' },
  { key: 'inventory', label: 'Inventory', value: '3.2 mo' },
  { key: 'new_listings', label: 'New Listings', value: '67' },
  { key: 'sold_listings', label: 'Sold Listings', value: '54' },
];

const SAMPLE_LISTINGS = [
  { address: '123 Oak Street', city: 'Austin, TX', price: '$475,000', beds: 3, baths: 2, sqft: '1,850' },
  { address: '456 Elm Avenue', city: 'Austin, TX', price: '$325,000', beds: 2, baths: 2, sqft: '1,200' },
  { address: '789 Pine Road', city: 'Austin, TX', price: '$650,000', beds: 4, baths: 3, sqft: '2,400' },
  { address: '321 Maple Drive', city: 'Austin, TX', price: '$550,000', beds: 3, baths: 2, sqft: '2,100' },
  { address: '654 Cedar Lane', city: 'Austin, TX', price: '$385,000', beds: 2, baths: 1, sqft: '1,400' },
  { address: '987 Birch Court', city: 'Austin, TX', price: '$720,000', beds: 5, baths: 3, sqft: '3,000' },
];

const SOCIAL_PLATFORMS: Record<string, string> = {
  facebook: '📘', instagram: '📷', linkedin: '💼', twitter: '🐦', youtube: '▶️', tiktok: '🎵',
};

function BlockPreview({ block, onUpdateChildren }: { block: NewsletterBlock; onUpdateChildren?: (children: NewsletterBlock[][]) => void }) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.props.level || 2}` as keyof JSX.IntrinsicElements;
      const sizes: Record<number, string> = { 1: 'text-3xl', 2: 'text-2xl', 3: 'text-xl', 4: 'text-lg' };
      return (
        <Tag
          className={`${sizes[block.props.level || 2]} font-bold`}
          style={{ textAlign: block.props.align, color: block.props.color, fontFamily: block.props.fontFamily }}
        >
          {block.props.text}
        </Tag>
      );
    }
    case 'text':
      return (
        <div
          className="prose prose-sm max-w-none"
          style={{ textAlign: block.props.align, color: block.props.color, fontSize: block.props.fontSize }}
          dangerouslySetInnerHTML={{ __html: block.props.html }}
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
    case 'market_data': {
      const selectedMetrics = block.props.metrics || ['median_sale_price', 'active_listings', 'days_on_market', 'price_per_sqft'];
      const filtered = SAMPLE_METRICS.filter(m => selectedMetrics.includes(m.key));
      return (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm mb-3">📊 {block.props.headerText || 'Market Update'}</p>
          {block.props.style === 'table' ? (
            <table className="w-full text-xs">
              <tbody>
                {filtered.map(m => (
                  <tr key={m.key} className="border-b border-blue-100 dark:border-blue-900">
                    <td className="py-1 text-blue-700 dark:text-blue-300">{m.label}</td>
                    <td className="py-1 text-right font-semibold text-blue-900 dark:text-blue-100">{m.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={`grid ${block.props.style === 'minimal' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'} gap-2`}>
              {filtered.map(m => (
                <div key={m.key} className={`${block.props.style === 'minimal' ? 'text-center py-1' : 'bg-white dark:bg-blue-900/40 rounded p-2 text-center'}`}>
                  <p className="text-xs text-blue-600 dark:text-blue-300">{m.label}</p>
                  <p className="font-bold text-sm text-blue-900 dark:text-blue-100">{m.value}</p>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 italic">Sample data — real stats populated per ZIP at send time</p>
        </div>
      );
    }
    case 'listings': {
      const count = Math.min(block.props.count || 3, SAMPLE_LISTINGS.length);
      const listings = SAMPLE_LISTINGS.slice(0, count);
      const isGrid = block.props.style === 'grid';
      return (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="font-semibold text-green-800 dark:text-green-200 text-sm mb-3">🏠 Featured Listings</p>
          <div className={isGrid ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
            {listings.map((l, i) => (
              <div key={i} className={`bg-white dark:bg-green-900/40 rounded border border-green-100 dark:border-green-800 overflow-hidden ${isGrid ? '' : 'flex items-center gap-3'}`}>
                <div className={`bg-green-100 dark:bg-green-800/50 flex items-center justify-center text-green-600 dark:text-green-300 ${isGrid ? 'h-20 w-full' : 'h-16 w-20 shrink-0'}`}>
                  <span className="text-2xl">🏡</span>
                </div>
                <div className="p-2 min-w-0">
                  <p className="font-semibold text-xs text-green-900 dark:text-green-100 truncate">{l.price}</p>
                  <p className="text-xs text-green-700 dark:text-green-300 truncate">{l.address}</p>
                  <p className="text-xs text-green-500 dark:text-green-400">{l.beds}bd · {l.baths}ba · {l.sqft} sqft</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-green-500 dark:text-green-400 mt-2 italic">Sample — real listings from pipeline at send time</p>
        </div>
      );
    }
    case 'agent_bio':
      return (
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="font-semibold text-sm">👤 Agent Bio Block</p>
          <p className="text-xs text-muted-foreground mt-1">Auto-populated from your profile at send time.</p>
        </div>
      );
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
              <ColumnDropZone key={i} columnIndex={i} children={col} onAddBlock={handleAddBlock} />
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
