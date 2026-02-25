import { useState, useCallback, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, EyeOff, Send, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BlockPalette } from './BlockPalette';
import { BuilderCanvas } from './BuilderCanvas';
import { BlockSettings } from './BlockSettings';
import { PreviewPanel } from './PreviewPanel';
import { SendSchedulePanel } from './SendSchedulePanel';
import { NewsletterBlock, GlobalStyles, DEFAULT_GLOBAL_STYLES } from './types';
import { useNewsletterTemplates } from '@/hooks/useNewsletterTemplates';
import { useAuth } from '@/hooks/useAuth';

export function NewsletterBuilder() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const { user } = useAuth();
  const { templates, saveTemplate, isSaving } = useNewsletterTemplates();

  const [blocks, setBlocks] = useState<NewsletterBlock[]>([]);
  const [globalStyles, setGlobalStyles] = useState<GlobalStyles>(DEFAULT_GLOBAL_STYLES);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('Monthly Newsletter');
  const [showPreview, setShowPreview] = useState(false);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [currentId, setCurrentId] = useState<string | undefined>(templateId);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const hasLoadedRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  // Load existing template
  useEffect(() => {
    if (templateId && templates.length > 0) {
      const t = templates.find(t => t.id === templateId);
      if (t) {
        isInitialLoadRef.current = true;
        setBlocks(t.blocks_json);
        setGlobalStyles(t.global_styles);
        setTemplateName(t.name);
        setCurrentId(t.id);
        hasLoadedRef.current = true;
        // Allow a tick for state to settle before enabling autosave
        setTimeout(() => { isInitialLoadRef.current = false; }, 500);
      }
    } else if (!templateId) {
      // New template — enable autosave after initial render
      setTimeout(() => { isInitialLoadRef.current = false; }, 500);
    }
  }, [templateId, templates]);

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) || null;

  const handleUpdateBlockProps = useCallback((props: Record<string, any>) => {
    if (!selectedBlockId) return;
    setBlocks(prev => prev.map(b => b.id === selectedBlockId ? { ...b, props: { ...b.props, ...props } } : b));
  }, [selectedBlockId]);

  const handleUpdateGlobalStyles = useCallback((partial: Partial<GlobalStyles>) => {
    setGlobalStyles(prev => ({ ...prev, ...partial }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaveStatus('saving');
    const result = await saveTemplate({
      id: currentId,
      agent_id: user.id,
      name: templateName,
      blocks_json: blocks,
      global_styles: globalStyles,
    });
    if (result?.id && !currentId) {
      setCurrentId(result.id);
      window.history.replaceState(null, '', `/newsletter-builder/${result.id}`);
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [user, currentId, templateName, blocks, globalStyles, saveTemplate]);

  // Debounced autosave
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (!user) return;

    setSaveStatus('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [blocks, globalStyles, templateName]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen flex flex-col bg-background">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => navigate('/newsletter')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="max-w-[260px] h-8 text-sm font-medium"
          />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>}
            {saveStatus === 'saved' && <><Check className="h-3 w-3 text-green-500" /> Saved</>}
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
            {showPreview ? 'Editor' : 'Preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSendPanel(true)}>
            <Send className="h-4 w-4 mr-1.5" />
            Send
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1.5" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {/* Main content */}
        {showPreview ? (
          <div className="flex-1 overflow-hidden">
            <PreviewPanel blocks={blocks} globalStyles={globalStyles} />
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Block Palette */}
            <ScrollArea className="w-[220px] border-r bg-card/50 p-3">
              <BlockPalette />
            </ScrollArea>

            {/* Center: Canvas */}
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-[640px] mx-auto" onClick={() => setSelectedBlockId(null)}>
                <div className="bg-card rounded-xl shadow-sm border p-6 min-h-[600px]">
                  <BuilderCanvas
                    blocks={blocks}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={setSelectedBlockId}
                    onUpdateBlocks={setBlocks}
                  />
                </div>
              </div>
            </ScrollArea>

            {/* Right: Settings */}
            <ScrollArea className="w-[280px] border-l bg-card/50 p-4">
              {selectedBlock ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                    {selectedBlock.type.replace('_', ' ')} Settings
                  </h3>
                  <BlockSettings block={selectedBlock} onUpdate={handleUpdateBlockProps} />
                </div>
              ) : (
                <BlockSettings
                  block={null}
                  onUpdate={() => {}}
                  globalStyles={globalStyles}
                  onUpdateGlobalStyles={handleUpdateGlobalStyles}
                />
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      <SendSchedulePanel
        open={showSendPanel}
        onClose={() => setShowSendPanel(false)}
        templateId={currentId}
        templateName={templateName}
      />
    </DndProvider>
  );
}
