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
import { BlockSettings, BrandColors } from './BlockSettings';
import { PreviewPanel } from './PreviewPanel';
import { SendSchedulePanel } from './SendSchedulePanel';
import { NewsletterBlock, GlobalStyles, DEFAULT_GLOBAL_STYLES } from './types';
import { useNewsletterTemplates } from '@/hooks/useNewsletterTemplates';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AgentData } from './renderBlocksToHtml';

export interface ChildPath {
  parentId: string;
  colIndex: number;
  childId: string;
}

export function NewsletterBuilder() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const { user } = useAuth();
  const { templates, saveTemplate, isSaving } = useNewsletterTemplates();

  const [blocks, setBlocks] = useState<NewsletterBlock[]>([]);
  const [globalStyles, setGlobalStyles] = useState<GlobalStyles>(DEFAULT_GLOBAL_STYLES);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedChildPath, setSelectedChildPath] = useState<ChildPath | null>(null);
  const [templateName, setTemplateName] = useState('Monthly Newsletter');
  const [showPreview, setShowPreview] = useState(false);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [currentId, setCurrentId] = useState<string | undefined>(templateId);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [brandColors, setBrandColors] = useState<BrandColors>({ primary: null, secondary: null });
  const [agentData, setAgentData] = useState<AgentData>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const hasLoadedRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  // Fetch brand colors and agent profile
  useEffect(() => {
    if (!user) return;
    // Fetch marketing settings
    supabase.from('agent_marketing_settings').select('primary_color, secondary_color, headshot_url, logo_colored_url').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setBrandColors({ primary: data.primary_color, secondary: data.secondary_color });
          setAgentData(prev => ({
            ...prev,
            headshot_url: data.headshot_url || undefined,
            logo_url: data.logo_colored_url || undefined,
          }));
        }
      });
    // Fetch profile
    supabase.from('profiles').select('first_name, last_name, full_name, email, phone_number, office_number, office_address, brokerage, license_number, website').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          const name = data.full_name || [data.first_name, data.last_name].filter(Boolean).join(' ');
          setAgentData(prev => ({
            ...prev,
            name: name || undefined,
            email: data.email || undefined,
            phone: data.phone_number || undefined,
            office_phone: data.office_number || undefined,
            office_address: data.office_address || undefined,
            brokerage: data.brokerage || undefined,
            license: data.license_number || undefined,
            website: data.website || undefined,
          }));
        }
      });
  }, [user]);

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
        setTimeout(() => { isInitialLoadRef.current = false; }, 500);
      }
    } else if (!templateId) {
      setTimeout(() => { isInitialLoadRef.current = false; }, 500);
    }
  }, [templateId, templates]);

  // Derive selected block - either top-level or nested child
  const selectedBlock = (() => {
    if (selectedChildPath) {
      const parent = blocks.find(b => b.id === selectedChildPath.parentId);
      const child = parent?.children?.[selectedChildPath.colIndex]?.find(c => c.id === selectedChildPath.childId);
      return child || null;
    }
    return blocks.find(b => b.id === selectedBlockId) || null;
  })();

  const handleSelectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
    setSelectedChildPath(null);
  }, []);

  const handleSelectChild = useCallback((path: ChildPath | null) => {
    setSelectedChildPath(path);
    setSelectedBlockId(null);
  }, []);

  const handleUpdateBlockProps = useCallback((props: Record<string, any>) => {
    if (selectedChildPath) {
      // Update a nested child block
      setBlocks(prev => prev.map(b => {
        if (b.id !== selectedChildPath.parentId) return b;
        const newChildren = (b.children || []).map((col, i) =>
          i !== selectedChildPath.colIndex ? col : col.map(c =>
            c.id !== selectedChildPath.childId ? c : { ...c, props: { ...c.props, ...props } }
          )
        );
        return { ...b, children: newChildren };
      }));
    } else if (selectedBlockId) {
      setBlocks(prev => prev.map(b => b.id === selectedBlockId ? { ...b, props: { ...b.props, ...props } } : b));
    }
  }, [selectedBlockId, selectedChildPath]);

  const handleUpdateGlobalStyles = useCallback((partial: Partial<GlobalStyles>) => {
    setGlobalStyles(prev => ({ ...prev, ...partial }));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedBlockId(null);
    setSelectedChildPath(null);
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
            <PreviewPanel blocks={blocks} globalStyles={globalStyles} agentData={agentData} />
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Block Palette */}
            <ScrollArea className="w-[220px] border-r bg-card/50 p-3">
              <BlockPalette />
            </ScrollArea>

            {/* Center: Canvas */}
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-[640px] mx-auto" onClick={handleClearSelection}>
                <div className="rounded-xl shadow-sm border p-6 min-h-[600px]" style={{ backgroundColor: globalStyles.backgroundColor, fontFamily: globalStyles.fontFamily }}>
                  <BuilderCanvas
                    blocks={blocks}
                    selectedBlockId={selectedBlockId}
                    selectedChildPath={selectedChildPath}
                    onSelectBlock={handleSelectBlock}
                    onSelectChild={handleSelectChild}
                    onUpdateBlocks={setBlocks}
                    brandColors={brandColors}
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
                  <BlockSettings block={selectedBlock} onUpdate={handleUpdateBlockProps} brandColors={brandColors} />
                </div>
              ) : (
                <BlockSettings
                  block={null}
                  onUpdate={() => {}}
                  globalStyles={globalStyles}
                  onUpdateGlobalStyles={handleUpdateGlobalStyles}
                  brandColors={brandColors}
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
