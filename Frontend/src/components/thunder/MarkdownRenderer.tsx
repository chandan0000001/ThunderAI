import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

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

  return (
    <div className="markdown-body leading-relaxed text-[15px] space-y-3 font-inter overflow-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
