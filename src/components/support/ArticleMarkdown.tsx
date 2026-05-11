/**
 * ArticleMarkdown — renders a support article body as styled markdown.
 *
 * Uses react-markdown + remark-gfm. The wrapper applies REOP design
 * tokens to headings, links, blockquotes, code, lists, and tables so
 * articles read consistently with the rest of the Hub.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  body: string;
}

export function ArticleMarkdown({ body }: Props) {
  return (
    <article className="prose-reop max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="font-display text-[clamp(1.4rem,1.8vw+0.6rem,1.9rem)] font-medium tracking-[-0.025em] text-reop-dark-blue mt-8 mb-4 first:mt-0 leading-[1.2]">{children}</h1>,
          h2: ({ children }) => <h2 className="font-display text-[clamp(1.2rem,1.4vw+0.5rem,1.5rem)] font-medium tracking-[-0.02em] text-reop-dark-blue mt-7 mb-3 leading-[1.25]">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-reop-dark-blue mt-6 mb-2.5">{children}</h3>,
          h4: ({ children }) => <h4 className="text-[15px] font-semibold text-reop-dark-blue mt-5 mb-2">{children}</h4>,
          p:  ({ children }) => <p className="text-[15px] leading-[1.75] text-foreground/90 my-3">{children}</p>,
          a:  ({ children, href }) => (
            <a
              href={href}
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="text-primary hover:underline font-medium"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-reop-dark-blue">{children}</strong>,
          em:     ({ children }) => <em className="italic text-foreground">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-6 my-3 space-y-1.5 text-[15px] leading-[1.7] text-foreground/90">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-3 space-y-1.5 text-[15px] leading-[1.7] text-foreground/90 [&>li]:pl-1">{children}</ol>,
          li: ({ children }) => <li className="[&>p]:my-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-[3px] border-primary bg-reop-teal-soft/40 pl-4 pr-3 py-2 italic text-foreground/85 leading-[1.65] rounded-r-lg">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-t border-border" />,
          code: ({ className, children, ...props }) => {
            const isInline = !className?.includes('language-');
            if (isInline) {
              return <code className="bg-[hsl(210_20%_94%)] text-reop-dark-blue px-1.5 py-0.5 rounded text-[0.92em] font-mono" {...props}>{children}</code>;
            }
            return (
              <pre className="my-4 bg-[hsl(210_47%_12%)] text-white rounded-lg p-4 overflow-x-auto text-[13px] leading-[1.6]">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-[14px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[hsl(210_20%_96%)] border-b border-border">{children}</thead>,
          th: ({ children }) => <th className="text-left px-4 py-2.5 font-semibold text-reop-dark-blue text-[13px]">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2.5 border-t border-border text-foreground/90">{children}</td>,
        }}
      >
        {body}
      </ReactMarkdown>
    </article>
  );
}
