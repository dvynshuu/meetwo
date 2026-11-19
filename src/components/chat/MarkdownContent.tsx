import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

interface MarkdownContentProps {
  content: string;
}

// Language normalization map
const LANG_MAP: Record<string, string> = {
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JSX',
  py: 'Python',
  python: 'Python',
  sql: 'SQL',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Shell',
  rs: 'Rust',
  rust: 'Rust',
  go: 'Go',
  golang: 'Go',
  c: 'C',
  cpp: 'C++',
  md: 'Markdown',
  markdown: 'Markdown',
};

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const displayLang = language
    ? LANG_MAP[language.toLowerCase()] || language.toUpperCase()
    : 'Code';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="studio-code-container">
      <div className="studio-code-header">
        <span className="studio-code-lang">{displayLang}</span>
        <Tooltip content={copied ? 'Copied to clipboard' : 'Copy code'} position="top">
          <button
            type="button"
            className="studio-code-copy-btn"
            onClick={handleCopy}
            aria-label="Copy code block"
          >
            {copied ? (
              <>
                <Check size={13} style={{ color: 'var(--status-online)' }} />
                <span style={{ color: 'var(--status-online)' }}>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </Tooltip>
      </div>
      <pre className="studio-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const SpoilerTag: React.FC<{ text: string }> = ({ text }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      className={`message-spoiler ${revealed ? 'revealed' : 'concealed'}`}
      onClick={() => setRevealed(!revealed)}
      title={revealed ? 'Click to hide spoiler' : 'Spoiler: click to reveal'}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setRevealed(!revealed);
        }
      }}
    >
      {text}
    </span>
  );
};

/**
 * Parses inline text for bold, italic, strikethrough, inline code, spoilers, mentions, and links.
 */
function renderInlineFormatting(text: string, keyPrefix: string): React.ReactNode[] {
  // Regex splitting by:
  // 1. Spoilers: ||...||
  // 2. Inline code: `...`
  // 3. Bold: **...**
  // 4. Strikethrough: ~~...~~
  // 5. Italic: *...*
  // 6. Mentions: @\w+
  // 7. Links: https?://\S+
  const inlineRegex =
    /(\|\|[\s\S]+?\|\||`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|@(?:everyone|here|[a-zA-Z0-9_-]+)|https?:\/\/[^\s<]+)/g;

  const parts = text.split(inlineRegex);

  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!part) return null;

    // Spoiler ||...||
    if (part.startsWith('||') && part.endsWith('||') && part.length >= 4) {
      return <SpoilerTag key={key} text={part.slice(2, -2)} />;
    }

    // Inline code `...`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={key} className="inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold **...**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={key} className="message-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Strikethrough ~~...~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
      return (
        <del key={key} className="message-strikethrough">
          {part.slice(2, -2)}
        </del>
      );
    }

    // Italic *...*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={key} className="message-italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Mention tag
    if (part.startsWith('@')) {
      const isSpecial = part === '@everyone' || part === '@here';
      return (
        <span key={key} className={`mention-tag ${isSpecial ? 'mention-special' : ''}`}>
          {part}
        </span>
      );
    }

    // URL Autolink
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a
          key={key}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="message-link"
        >
          <span>{part}</span>
          <ExternalLink size={11} className="message-link-icon" />
        </a>
      );
    }

    return part;
  });
}

// Test for jumbo emoji (1 to 3 emojis with optional whitespace)
const JUMBO_EMOJI_REGEX =
  /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component}|\s){1,3}$/u;

export const MarkdownContent: React.FC<MarkdownContentProps> = React.memo(({ content }) => {
  if (!content) return null;

  // Ultra-fast path: plain text without markdown or link syntax
  // Bypasses all regex engines and array allocations for ~90% of conversational chat messages
  if (
    !content.includes('`') &&
    !content.includes('*') &&
    !content.includes('_') &&
    !content.includes('~') &&
    !content.includes('@') &&
    !content.includes('>') &&
    !content.includes('|') &&
    !content.includes('http') &&
    !content.includes('\n') &&
    content.length > 0 &&
    content.charCodeAt(0) > 127 ? !JUMBO_EMOJI_REGEX.test(content.trim()) : true
  ) {
    return <span className="markdown-line">{content}</span>;
  }

  // Check for Jumbo emoji message
  const trimmed = content.trim();
  if (
    trimmed.length > 0 &&
    trimmed.length <= 12 &&
    JUMBO_EMOJI_REGEX.test(trimmed) &&
    !trimmed.includes('`') &&
    !trimmed.includes('*') &&
    !trimmed.includes('@')
  ) {
    return <div className="jumbo-emoji-container">{trimmed}</div>;
  }

  // Fenced code blocks regex
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Render text before code block
    if (match.index > lastIndex) {
      const textChunk = content.slice(lastIndex, match.index);
      segments.push(renderTextWithQuotes(textChunk, `seg-${lastIndex}`));
    }

    const language = match[1]?.trim() || '';
    const code = match[2]?.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '') || '';

    segments.push(
      <CodeBlock key={`code-${match.index}`} code={code} language={language} />
    );

    lastIndex = match.index + match[0].length;
  }

  // Render remaining text after last code block
  if (lastIndex < content.length) {
    const textChunk = content.slice(lastIndex);
    segments.push(renderTextWithQuotes(textChunk, `seg-${lastIndex}`));
  }

  return <div className="markdown-rendered-content">{segments}</div>;
});

/**
 * Handles blockquotes (> quote) and line-by-line inline formatting
 */
function renderTextWithQuotes(chunk: string, keyPrefix: string): React.ReactNode {
  const lines = chunk.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let currentQuoteLines: string[] = [];
  let lineIdx = 0;

  const flushQuote = () => {
    if (currentQuoteLines.length > 0) {
      const quoteText = currentQuoteLines.join('\n');
      renderedElements.push(
        <blockquote key={`${keyPrefix}-quote-${lineIdx}`} className="message-blockquote">
          {renderInlineFormatting(quoteText, `${keyPrefix}-quote-content-${lineIdx}`)}
        </blockquote>
      );
      currentQuoteLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('> ') || line === '>') {
      currentQuoteLines.push(line.replace(/^>\s?/, ''));
    } else {
      flushQuote();
      renderedElements.push(
        <div key={`${keyPrefix}-line-${i}`} className="markdown-line">
          {renderInlineFormatting(line, `${keyPrefix}-inline-${i}`)}
        </div>
      );
    }
    lineIdx++;
  }

  flushQuote();
  return <React.Fragment key={keyPrefix}>{renderedElements}</React.Fragment>;
}
