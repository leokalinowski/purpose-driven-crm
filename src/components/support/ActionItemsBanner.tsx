import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ActionItem } from '@/hooks/useActionItems';

interface ActionItemsBannerProps {
  items: ActionItem[];
  onDismiss: (id: string) => void;
}

export function ActionItemsBanner({ items, onDismiss }: ActionItemsBannerProps) {
  if (items.length === 0) return null;

  // Show the first high priority item as a banner
  const item = items[0];

  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-destructive">{item.title}</h3>
          {item.description && (
            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
          )}
          {item.action_url && (
            <Link to={item.action_url}>
              <Button variant="destructive" size="sm" className="mt-3">
                Take Action
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => onDismiss(item.id)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
      {items.length > 1 && (
        <p className="text-xs text-muted-foreground mt-3 ml-8">
          +{items.length - 1} more urgent item{items.length > 2 ? 's' : ''} to address
        </p>
      )}
    </div>
  );
}
