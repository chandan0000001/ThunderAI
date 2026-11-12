import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ExternalLink, Globe } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Extract unique web sources from markdown links for top Sources Tray
  const sources = useMemo(() => {
    if (!content) return [];
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
    const found: Array<{ label: string; url: string; domain: string; index: number }> = [];
    const seenUrls = new Set<string>();

    let match;
    let idx = 1;
    while ((match = linkRegex.exec(content)) !== null) {
      const label = match[1].trim();
      const url = match[2].trim();
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        let domain = url;
        try {
          domain = new URL(url).hostname.replace(/^www\./, '');
        } catch {}
        found.push({ label, url, domain, index: idx++ });
      }
    }
    return found;
  }, [content]);

  return (
    <div className="markdown-body leading-relaxed text-[15px] space-y-3 font-inter overflow-hidden">
      {/* Top Interactive Sources Carousel / Tray when Web Grounding is present */}
      {sources.length > 0 && (
        <div className="mb-4 pb-3 border-b border-white/[0.08] not-prose">
          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-zinc-400 mb-2">
            <Globe className="w-3.5 h-3.5 text-yellow-400" />
            <span className="font-semibold text-zinc-300 uppercase tracking-wider">
              Sources ({sources.length})
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-white/10">
            {sources.map((src) => (
              <a
                key={src.url}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${src.label}\n${src.url}`}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-yellow-400/10 border border-white/10 hover:border-yellow-400/40 text-xs text-zinc-300 hover:text-yellow-300 transition-all shrink-0 shadow-sm hover:shadow-md hover:shadow-yellow-500/10 hover:-translate-y-0.5 group no-underline"
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${src.domain}&sz=32`}
                  alt=""
                  className="w-3.5 h-3.5 rounded-xs shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="font-medium text-zinc-200 group-hover:text-yellow-200 max-w-[130px] truncate">
                  {src.domain}
                </span>
                <span className="text-[10px] font-mono text-zinc-500 group-hover:text-yellow-400/80">
                  [{src.index}]
                </span>
                <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-yellow-300 shrink-0 opacity-70 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </div>
      )}

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ANCHORS / HYPERLINKS - Highlighting source links as interactive pills
          a: ({ href, children, ...props }) => {
            if (!href) return <span>{children}</span>;

            let domain = '';
            try {
              domain = new URL(href).hostname.replace(/^www\./, '');
            } catch {
              domain = href;
            }

            const childText = String(children || '').trim();
            const isSourceRef =
              /^source\s*\[?\d+\]?/i.test(childText) ||
              /^\[\d+\]$/.test(childText) ||
              /^\d+$/.test(childText);

            // Highlighted pill badge for source citations
            if (isSourceRef) {
              const numMatch = childText.match(/\d+/);
              const num = numMatch ? numMatch[0] : '';

              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Source ${num}: ${domain}\n${href}`}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 my-0.5 mx-1 rounded-xl bg-white/[0.05] hover:bg-yellow-400/15 border border-white/10 hover:border-yellow-400/50 text-xs font-mono text-zinc-300 hover:text-yellow-200 transition-all shadow-sm hover:shadow-md hover:shadow-yellow-500/10 hover:-translate-y-0.5 group no-underline align-middle"
                  {...props}
                >
                  <span className="w-4 h-4 rounded-full bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 flex items-center justify-center text-[10px] font-bold">
                    {num || '•'}
                  </span>
                  <span className="font-sans font-medium text-zinc-200 group-hover:text-yellow-100 truncate max-w-[150px] sm:max-w-[220px]">
                    {domain}
                  </span>
                  <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-yellow-300 shrink-0 opacity-75 group-hover:opacity-100" />
                </a>
              );
            }

            // General styled inline link
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-0.5 text-yellow-400 hover:text-yellow-300 underline underline-offset-4 decoration-yellow-500/40 hover:decoration-yellow-400 font-medium transition group"
                {...props}
              >
                <span>{children}</span>
                <ExternalLink className="w-3 h-3 inline-block ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
              </a>
            );
          },
          // TABLES - Beautiful, scrollable table formatting
          table: ({ ...props }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-white/10 bg-[#16171d]/60 shadow-lg">
              <table className="w-full text-left text-xs border-collapse" {...props} />
            </div>
          ),
          thead: ({ ...props }) => (
            <thead className="bg-white/[0.06] border-b border-white/10 text-white font-semibold uppercase tracking-wider text-[11px]" {...props} />
          ),
          tbody: ({ ...props }) => (
            <tbody className="divide-y divide-white/[0.05]" {...props} />
          ),
          tr: ({ ...props }) => (
            <tr className="hover:bg-white/[0.02] transition-colors" {...props} />
          ),
          th: ({ ...props }) => (
            <th className="py-3 px-4 font-semibold text-zinc-200" {...props} />
          ),
          td: ({ ...props }) => (
            <td className="py-3 px-4 text-zinc-300 leading-normal" {...props} />
          ),

          // HEADINGS
          h1: ({ ...props }) => (
            <h1 className="text-2xl font-bold text-white pt-4 pb-2 border-b border-white/10" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="text-xl font-bold text-white pt-3 pb-1.5" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="text-lg font-semibold text-yellow-300 pt-2.5 pb-1" {...props} />
          ),
          h4: ({ ...props }) => (
            <h4 className="text-base font-semibold text-white pt-2 pb-1" {...props} />
          ),

          // PARAGRAPHS
          p: ({ ...props }) => (
            <p className="leading-relaxed text-zinc-200 my-2" {...props} />
          ),

          // STRONG & EM
          strong: ({ ...props }) => (
            <strong className="font-bold text-white" {...props} />
          ),
          em: ({ ...props }) => (
            <em className="italic text-zinc-300" {...props} />
          ),

          // LISTS
          ul: ({ ...props }) => (
            <ul className="list-disc list-outside pl-5 space-y-1.5 my-2.5 text-zinc-300" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="list-decimal list-outside pl-5 space-y-1.5 my-2.5 text-zinc-300" {...props} />
          ),
          li: ({ ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),

          // BLOCKQUOTE
          blockquote: ({ ...props }) => (
            <blockquote className="border-l-2 border-yellow-400 pl-4 py-1.5 my-3 text-zinc-300 italic bg-yellow-400/[0.03] rounded-r-lg" {...props} />
          ),

          // CODE BLOCKS & INLINE CODE
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const codeId = `code-${Math.random()}`;

            if (!inline && (match || codeString.includes('\n'))) {
              const lang = match ? match[1] : 'code';
              return (
                <div className="my-4 rounded-xl overflow-hidden bg-[#111216] border border-white/10 shadow-xl font-mono text-xs">
                  <div className="flex items-center justify-between px-4 py-2 bg-white/[0.04] border-b border-white/[0.08] text-zinc-400">
                    <span className="uppercase text-[11px] font-semibold tracking-wider text-yellow-300">{lang}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(codeString, codeId)}
                      className="flex items-center space-x-1.5 px-2.5 py-1 rounded hover:bg-white/10 text-zinc-300 hover:text-white transition"
                    >
                      {copiedCodeId === codeId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-[#e4e4e7] leading-relaxed">
                    <code {...props}>{codeString}</code>
                  </pre>
                </div>
              );
            }

            return (
              <code className="px-1.5 py-0.5 rounded bg-white/10 text-yellow-300 font-mono text-[13px]" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
