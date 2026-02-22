"use client";

import { useState, useCallback, type ReactNode, Children, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { Check, Copy, ChevronDown, ChevronRight } from "lucide-react";

/* ── Language display names ──────────────────────────────────────────── */

const LANG_NAMES: Record<string, string> = {
  js: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  tsx: "TSX",
  py: "Python",
  rb: "Ruby",
  rs: "Rust",
  go: "Go",
  java: "Java",
  kt: "Kotlin",
  cs: "C#",
  cpp: "C++",
  c: "C",
  sh: "Shell",
  bash: "Bash",
  zsh: "Zsh",
  ps1: "PowerShell",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  xml: "XML",
  md: "Markdown",
  graphql: "GraphQL",
  dockerfile: "Dockerfile",
  makefile: "Makefile",
  toml: "TOML",
  ini: "INI",
  swift: "Swift",
  dart: "Dart",
  php: "PHP",
  lua: "Lua",
  r: "R",
  scala: "Scala",
  elixir: "Elixir",
  haskell: "Haskell",
  ocaml: "OCaml",
  zig: "Zig",
  vue: "Vue",
  svelte: "Svelte",
  prisma: "Prisma",
  proto: "Protocol Buffers",
  terraform: "Terraform",
  hcl: "HCL",
  text: "Text",
  plaintext: "Text",
};

function formatLangName(lang: string): string {
  const l = lang.toLowerCase();
  return LANG_NAMES[l] ?? lang.charAt(0).toUpperCase() + lang.slice(1);
}

/* ── Extract text from React children (for copy) ─────────────────────── */

function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

/* ── CodeBlock with copy button ──────────────────────────────────────── */

function CodeBlock({ children, language }: { children: ReactNode; language: string | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = extractText(children);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard API not available */
    }
  }, [children]);

  return (
    <div className="group/code relative rounded-lg border border-border overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
        {language && (
          <span className="rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {formatLangName(language)}
          </span>
        )}
        {!language && <span />}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs font-mono leading-relaxed bg-muted/30">
        {children}
      </pre>
    </div>
  );
}

/* ── Thinking block ──────────────────────────────────────────────────── */

function ThinkingBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  if (!content) return null;

  return (
    <div className="my-2 rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="font-medium">Thinking</span>
      </button>
      {open && (
        <div className="px-3 pb-2 border-l-2 border-amber-500/30 ml-3 text-xs text-muted-foreground whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

/* ── Markdown components ─────────────────────────────────────────────── */

const components: Components = {
  pre({ children }) {
    // Extract language from the child <code> element
    let language: string | null = null;
    const codeChild = Children.toArray(children).find(
      (child) => isValidElement(child) && child.type === "code"
    );
    if (isValidElement(codeChild)) {
      const cls = (codeChild.props as { className?: string }).className;
      const match = cls?.match(/language-(\w+)/);
      if (match) language = match[1];
    }
    return <CodeBlock language={language}>{children}</CodeBlock>;
  },
  code({ children, className, ...props }) {
    const isBlock = className?.startsWith("language-") || className?.startsWith("hljs");
    if (isBlock) {
      return <code className={className} {...props}>{children}</code>;
    }
    return (
      <code
        className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono border border-border/50"
        {...props}
      >
        {children}
      </code>
    );
  },
  p({ children }) {
    return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
  },
  ul({ children }) {
    return <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-sm">{children}</li>;
  },
  h1({ children }) {
    return <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground italic my-2">
        {children}
      </blockquote>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="text-xs border-collapse w-full">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-border bg-muted/50 px-2 py-1 text-left font-medium">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-border px-2 py-1">{children}</td>
    );
  },
  hr() {
    return <hr className="border-border my-3" />;
  },
  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic">{children}</em>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    );
  },
};

/* ── Exported components ─────────────────────────────────────────────── */

interface MarkdownMessageProps {
  content: string;
  thinking?: string | null;
}

export function MarkdownMessage({ content, thinking }: MarkdownMessageProps) {
  if (!content && !thinking) return null;
  return (
    <div className="prose-sm max-w-none text-sm">
      {thinking && <ThinkingBlock content={thinking} />}
      {content && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      )}
    </div>
  );
}
