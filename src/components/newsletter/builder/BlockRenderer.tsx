import { useDrag, useDrop } from 'react-dnd';
import { Trash2, Copy, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewsletterBlock } from './types';

interface BlockRendererProps {
  block: NewsletterBlock;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (from: number, to: number) => void;
  onUpdate: (props: Record<string, any>) => void;
  totalBlocks: number;
}

export function BlockRenderer({ block, index, isSelected, onSelect, onDelete, onDuplicate, onMove, onUpdate, totalBlocks }: BlockRendererProps) {
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
        <BlockPreview block={block} />
      </div>
    </div>
  );
}

function BlockPreview({ block }: { block: NewsletterBlock }) {
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
    case 'market_data':
      return (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">📊 Market Data Block</p>
          <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">Dynamic ZIP code market stats will appear here at send time.</p>
        </div>
      );
    case 'listings':
      return (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="font-semibold text-green-800 dark:text-green-200 text-sm">🏠 Listings Block</p>
          <p className="text-xs text-green-600 dark:text-green-300 mt-1">
            {block.props.count} property listing{block.props.count !== 1 ? 's' : ''} ({block.props.style} layout) — populated from pipeline at send time.
          </p>
        </div>
      );
    case 'agent_bio':
      return (
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="font-semibold text-sm">👤 Agent Bio Block</p>
          <p className="text-xs text-muted-foreground mt-1">Auto-populated from your profile at send time.</p>
        </div>
      );
    case 'social_icons':
      return (
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4" style={{ textAlign: block.props.align }}>
          <p className="font-semibold text-purple-800 dark:text-purple-200 text-sm">🔗 Social Icons</p>
          <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">Social media links auto-populated from your profile.</p>
        </div>
      );
    case 'columns':
      return (
        <div className="bg-muted/50 rounded-lg p-4 border border-dashed">
          <p className="text-xs text-muted-foreground text-center">{block.props.columns || 2}-column layout (coming soon)</p>
        </div>
      );
    case 'html_raw':
      return (
        <div className="bg-muted rounded-lg p-3 font-mono text-xs">
          {block.props.html || '<p>Custom HTML here</p>'}
        </div>
      );
    default:
      return <div className="text-sm text-muted-foreground">[{block.type}]</div>;
  }
}
