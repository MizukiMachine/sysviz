import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from '@/hooks/useChat';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

/**
 * During streaming, markdown may be syntactically incomplete.
 * Close unclosed constructs so ReactMarkdown can parse the content properly.
 */
function prepareMarkdown(raw: string): string {
  let content = raw;

  // Close unclosed fenced code blocks (odd number of ```)
  const fenceCount = (content.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) {
    content += '\n```';
  }

  // Close unclosed inline code (odd number of single backticks not part of ```)
  // Count ` that are not part of ```
  const stripped = content.replace(/```[\s\S]*?(?:```|$)/g, '');
  const inlineTickCount = (stripped.match(/`/g) || []).length;
  if (inlineTickCount % 2 !== 0) {
    content += '`';
  }

  return content;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const content = isUser ? message.content : prepareMarkdown(message.content);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`
          max-w-[85%] px-5 py-3.5 rounded-2xl text-base leading-relaxed
          ${
            isUser
              ? 'bg-blue-500/10 text-slate-800 rounded-br-md'
              : 'bg-white/60 text-slate-800 rounded-bl-md border border-white/50'
          }
        `}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          content ? (
            <div className="markdown-body break-words [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:mt-0.5 [&_li]:leading-snug [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-0.5 [&_strong]:font-semibold [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[15px] [&_code]:font-mono [&_pre]:bg-slate-900/90 [&_pre]:text-slate-100 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:mt-2 [&_pre]:mb-2 [&_pre]:overflow-x-auto [&_pre]:text-[15px] [&_pre]:leading-relaxed [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_a]:text-blue-500 [&_a]:underline [&_a]:underline-offset-2 [&_hr]:border-slate-200 [&_hr]:my-2 [&_table]:text-[15px] [&_table]:w-full [&_th]:border [&_th]:border-slate-200 [&_th]:px-3 [&_th]:py-2 [&_th]:bg-slate-50 [&_th]:font-semibold [&_th]:text-left [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <span className="inline-flex gap-1">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          )
        )}
      </div>
    </div>
  );
}
