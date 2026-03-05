import { useState, useCallback, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, EyeOff, Send, Check, Loader2, Sparkles, CheckCircle, PanelLeft, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { BlockPalette } from './BlockPalette';
import { BuilderCanvas } from './BuilderCanvas';
import { BlockSettings, BrandColors } from './BlockSettings';
import { PreviewPanel } from './PreviewPanel';
import { SendSchedulePanel } from './SendSchedulePanel';
import { NewsletterBlock, GlobalStyles, DEFAULT_GLOBAL_STYLES } from './types';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  const [templateAgentId, setTemplateAgentId] = useState<string | undefined>();
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const hasLoadedRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  // Load existing template directly by ID (bypasses hook's agent filter)
  useEffect(() => {
    if (!templateId) {
      setTimeout(() => { isInitialLoadRef.current = false; }, 500);
      return;
    }
    if (hasLoadedRef.current) return;

    supabase.from('newsletter_templates').select('*').eq('id', templateId).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('Failed to load template:', error);
          setTimeout(() => { isInitialLoadRef.current = false; }, 500);
          return;
        }
        isInitialLoadRef.current = true;
        setBlocks((data.blocks_json || []) as unknown as NewsletterBlock[]);
        setGlobalStyles({ ...DEFAULT_GLOBAL_STYLES, ...(data.global_styles as any || {}) });
        setTemplateName(data.name);
        setCurrentId(data.id);
        setTemplateAgentId(data.agent_id);
        setReviewStatus((data as any).review_status || null);
        setAiGenerated((data as any).ai_generated || false);
        hasLoadedRef.current = true;
        setTimeout(() => { isInitialLoadRef.current = false; }, 500);
      });
  }, [templateId]);

  // Fetch brand colors and agent profile for the template's agent (or current user)
  const brandOwnerId = templateAgentId || user?.id;
  useEffect(() => {
    if (!brandOwnerId) return;
    supabase.from('agent_marketing_settings').select('primary_color, secondary_color, headshot_url, logo_colored_url').eq('user_id', brandOwnerId).maybeSingle()
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
    supabase.from('profiles').select('first_name, last_name, full_name, email, phone_number, office_number, office_address, brokerage, license_number, website').eq('user_id', brandOwnerId).maybeSingle()
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
  }, [brandOwnerId]);

  // Derive selected block
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
      setBlocks(prev => prev.map(b => {
        if (b.id !== selectedBlockId) return b;
        const updated = { ...b, props: { ...b.props, ...props } };
        if (b.type === 'columns' && props._syncChildren) {
          const newCount = props.columns || 2;
          const currentChildren = b.children || [];
          if (newCount > currentChildren.length) {
            updated.children = [...currentChildren, ...Array.from({ length: newCount - currentChildren.length }, () => [])];
          } else {
            updated.children = currentChildren.slice(0, newCount);
          }
          delete updated.props._syncChildren;
        }
        return updated;
      }));
    }
  }, [selectedBlockId, selectedChildPath]);

  const handleUpdateGlobalStyles = useCallback((partial: Partial<GlobalStyles>) => {
    setGlobalStyles(prev => ({ ...prev, ...partial }));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedBlockId(null);
    setSelectedChildPath(null);
  }, []);

  const handleSave = useCallback(async (silent = false) => {
    if (!user) return;
    setSaveStatus('saving');
    const result = await saveTemplate({
      id: currentId,
      agent_id: templateAgentId || user.id,
      name: templateName,
      blocks_json: blocks,
      global_styles: globalStyles,
      _silent: silent,
    });
    if (result?.id && !currentId) {
      setCurrentId(result.id);
      window.history.replaceState(null, '', `/newsletter-builder/${result.id}`);
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [user, currentId, templateName, blocks, globalStyles, saveTemplate, templateAgentId]);

  // Debounced autosave
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (!user) return;

    setSaveStatus('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSave(true);
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [blocks, globalStyles, templateName]);

  const handleApprove = async () => {
    if (!currentId) return;
    await supabase.from('newsletter_templates').update({ review_status: 'approved', is_active: true }).eq('id', currentId);
    setReviewStatus('approved');
  };

  // Settings panel content — shared between desktop sidebar and mobile sheet
  const settingsContent = selectedBlock ? (
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
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen flex flex-col bg-background">
        {/* AI Review Banner */}
        {aiGenerated && reviewStatus === 'pending_review' && (
          <Alert className="rounded-none border-x-0 border-t-0 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-amber-800 dark:text-amber-200">
                <strong>AI-Generated Draft</strong> — Review and edit this newsletter before sending.
              </span>
              <Button size="sm" variant="outline" className="border-amber-300 hover:bg-amber-100" onClick={handleApprove}>
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {aiGenerated && reviewStatus === 'approved' && (
          <Alert className="rounded-none border-x-0 border-t-0 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>Approved</strong> — This AI-generated newsletter has been reviewed and approved.
            </AlertDescription>
          </Alert>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b bg-card shadow-sm overflow-x-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="max-w-[180px] sm:max-w-[260px] h-8 text-sm font-medium"
          />
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>}
            {saveStatus === 'saved' && <><Check className="h-3 w-3 text-green-500" /> Saved</>}
          </div>
          <div className="flex-1" />

          {/* Mobile: Block Palette & Settings drawers */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-4">
                <h3 className="text-sm font-semibold mb-3">Add Blocks</h3>
                <BlockPalette />
              </SheetContent>
            </Sheet>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] p-4 overflow-y-auto">
                <h3 className="text-sm font-semibold mb-3">Settings</h3>
                {settingsContent}
              </SheetContent>
            </Sheet>
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="shrink-0">
            {showPreview ? <EyeOff className="h-4 w-4 sm:mr-1.5" /> : <Eye className="h-4 w-4 sm:mr-1.5" />}
            <span className="hidden sm:inline">{showPreview ? 'Editor' : 'Preview'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSendPanel(true)} className="shrink-0">
            <Send className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Send</span>
          </Button>
          <Button size="sm" onClick={() => handleSave(false)} disabled={isSaving} className="shrink-0">
            <Save className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
          </Button>
        </div>

        {/* Main content */}
        {showPreview ? (
          <div className="flex-1 overflow-hidden">
            <PreviewPanel blocks={blocks} globalStyles={globalStyles} agentData={agentData} />
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Block Palette — hidden on mobile */}
            <ScrollArea className="hidden md:block w-[220px] border-r bg-card/50 p-3">
              <BlockPalette />
            </ScrollArea>

            {/* Center: Canvas */}
            <ScrollArea className="flex-1 p-4 sm:p-6">
              <div className="max-w-[640px] mx-auto" onClick={handleClearSelection}>
                <div className="rounded-xl shadow-sm min-h-[600px]" style={{ backgroundColor: globalStyles.backgroundColor, padding: '24px 16px' }}>
                  <div className="mx-auto rounded-lg border p-4 sm:p-6" style={{ maxWidth: globalStyles.contentWidth || 640, backgroundColor: '#ffffff', fontFamily: globalStyles.fontFamily, color: globalStyles.bodyColor }}>
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
              </div>
            </ScrollArea>

            {/* Right: Settings — hidden on mobile */}
            <ScrollArea className="hidden md:block w-[280px] border-l bg-card/50 p-4">
              {settingsContent}
            </ScrollArea>
          </div>
        )}
      </div>

      <SendSchedulePanel
        open={showSendPanel}
        onClose={() => setShowSendPanel(false)}
        templateId={currentId}
        templateName={templateName}
        agentId={templateAgentId}
      />
    </DndProvider>
  );
}
