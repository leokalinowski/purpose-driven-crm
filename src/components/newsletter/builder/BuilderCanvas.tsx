import { useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { NewsletterBlock, BlockType, BLOCK_DEFAULTS } from './types';
import { BlockRenderer } from './BlockRenderer';
import { Plus } from 'lucide-react';
import { BrandColors } from './BlockSettings';
import { ChildPath } from './NewsletterBuilder';

interface BuilderCanvasProps {
  blocks: NewsletterBlock[];
  selectedBlockId: string | null;
  selectedChildPath: ChildPath | null;
  onSelectBlock: (id: string | null) => void;
  onSelectChild: (path: ChildPath | null) => void;
  onUpdateBlocks: (blocks: NewsletterBlock[]) => void;
  brandColors?: BrandColors;
}

function generateId() {
  return crypto.randomUUID();
}

export function BuilderCanvas({ blocks, selectedBlockId, selectedChildPath, onSelectBlock, onSelectChild, onUpdateBlocks, brandColors }: BuilderCanvasProps) {
  const createBlock = useCallback((type: BlockType, index?: number): void => {
    const defaults = { ...BLOCK_DEFAULTS[type] };
    if (brandColors?.primary) {
      if (type === 'button') defaults.backgroundColor = brandColors.primary;
      if (type === 'heading') defaults.color = brandColors.primary;
    }
    const newBlock: NewsletterBlock = {
      id: generateId(),
      type,
      props: defaults,
      ...(type === 'columns' ? { children: [[], []] } : {}),
    };
    const updated = [...blocks];
    if (index !== undefined) {
      updated.splice(index, 0, newBlock);
    } else {
      updated.push(newBlock);
    }
    onUpdateBlocks(updated);
    onSelectBlock(newBlock.id);
  }, [blocks, onUpdateBlocks, onSelectBlock, brandColors]);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'BLOCK',
    drop: (item: { blockType: BlockType }, monitor) => {
      if (monitor.didDrop()) return;
      createBlock(item.blockType);
    },
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
  }), [createBlock]);

  const moveBlock = useCallback((fromIndex: number, toIndex: number) => {
    const updated = [...blocks];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onUpdateBlocks(updated);
  }, [blocks, onUpdateBlocks]);

  const deleteBlock = useCallback((id: string) => {
    onUpdateBlocks(blocks.filter(b => b.id !== id));
    if (selectedBlockId === id) onSelectBlock(null);
  }, [blocks, selectedBlockId, onUpdateBlocks, onSelectBlock]);

  const duplicateBlock = useCallback((id: string) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    const cloned: NewsletterBlock = JSON.parse(JSON.stringify(blocks[idx]));
    cloned.id = generateId();
    const updated = [...blocks];
    updated.splice(idx + 1, 0, cloned);
    onUpdateBlocks(updated);
    onSelectBlock(cloned.id);
  }, [blocks, onUpdateBlocks, onSelectBlock]);

  const updateBlock = useCallback((id: string, props: Record<string, any>) => {
    onUpdateBlocks(blocks.map(b => b.id === id ? { ...b, props: { ...b.props, ...props } } : b));
  }, [blocks, onUpdateBlocks]);

  const updateBlockChildren = useCallback((id: string, children: NewsletterBlock[][]) => {
    onUpdateBlocks(blocks.map(b => b.id === id ? { ...b, children } : b));
  }, [blocks, onUpdateBlocks]);

  // Child block operations
  const deleteChildBlock = useCallback((parentId: string, colIndex: number, childId: string) => {
    onUpdateBlocks(blocks.map(b => {
      if (b.id !== parentId) return b;
      const newChildren = (b.children || []).map((col, i) =>
        i !== colIndex ? col : col.filter(c => c.id !== childId)
      );
      return { ...b, children: newChildren };
    }));
    if (selectedChildPath?.childId === childId) onSelectChild(null);
  }, [blocks, onUpdateBlocks, selectedChildPath, onSelectChild]);

  const duplicateChildBlock = useCallback((parentId: string, colIndex: number, childId: string) => {
    onUpdateBlocks(blocks.map(b => {
      if (b.id !== parentId) return b;
      const newChildren = (b.children || []).map((col, i) => {
        if (i !== colIndex) return col;
        const idx = col.findIndex(c => c.id === childId);
        if (idx === -1) return col;
        const cloned: NewsletterBlock = JSON.parse(JSON.stringify(col[idx]));
        cloned.id = generateId();
        const newCol = [...col];
        newCol.splice(idx + 1, 0, cloned);
        return newCol;
      });
      return { ...b, children: newChildren };
    }));
  }, [blocks, onUpdateBlocks]);

  return (
    <div
      ref={drop}
      className={`min-h-[400px] rounded-lg transition-colors ${isOver ? 'bg-primary/5 ring-2 ring-primary/20' : ''}`}
    >
      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-lg">
          <Plus className="h-8 w-8 mb-2" />
          <p className="text-sm font-medium">Drag blocks here to start building</p>
          <p className="text-xs mt-1">Or click a block type from the palette</p>
        </div>
      ) : (
        <div className="space-y-1">
          {blocks.map((block, index) => (
            <BlockRenderer
              key={block.id}
              block={block}
              index={index}
              isSelected={selectedBlockId === block.id}
              selectedChildPath={selectedChildPath}
              onSelect={() => onSelectBlock(block.id)}
              onSelectChild={onSelectChild}
              onDelete={() => deleteBlock(block.id)}
              onDuplicate={() => duplicateBlock(block.id)}
              onMove={moveBlock}
              onUpdate={(props) => updateBlock(block.id, props)}
              onUpdateChildren={(children) => updateBlockChildren(block.id, children)}
              onDeleteChild={deleteChildBlock}
              onDuplicateChild={duplicateChildBlock}
              totalBlocks={blocks.length}
            />
          ))}
        </div>
      )}
    </div>
  );
}
