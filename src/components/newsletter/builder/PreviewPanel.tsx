import { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewsletterBlock, GlobalStyles } from './types';
import { renderBlocksToHtml, AgentData } from './renderBlocksToHtml';

interface PreviewPanelProps {
  blocks: NewsletterBlock[];
  globalStyles: GlobalStyles;
  agentData?: AgentData;
}

export function PreviewPanel({ blocks, globalStyles, agentData }: PreviewPanelProps) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const html = renderBlocksToHtml(blocks, globalStyles, agentData);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b">
        <Button variant={device === 'desktop' ? 'default' : 'outline'} size="sm" onClick={() => setDevice('desktop')}>
          <Monitor className="h-4 w-4 mr-1" /> Desktop
        </Button>
        <Button variant={device === 'mobile' ? 'default' : 'outline'} size="sm" onClick={() => setDevice('mobile')}>
          <Smartphone className="h-4 w-4 mr-1" /> Mobile
        </Button>
      </div>
      <div className="flex-1 overflow-auto bg-muted/30 p-4 flex justify-center">
        <iframe
          srcDoc={html}
          title="Newsletter Preview"
          className="bg-white shadow-lg rounded-lg border"
          style={{
            width: device === 'desktop' ? '100%' : 375,
            maxWidth: device === 'desktop' ? 700 : 375,
            height: '100%',
            minHeight: 500,
          }}
        />
      </div>
    </div>
  );
}
