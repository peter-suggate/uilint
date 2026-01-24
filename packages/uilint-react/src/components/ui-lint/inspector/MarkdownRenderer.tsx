"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer for rule documentation
 * Supports: headings, bold, italic, code, links, lists, blockquotes
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const rendered = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "text-foreground",
        // Headings
        "[&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-foreground",
        "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-foreground",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-foreground",
        // Paragraphs
        "[&_p]:text-sm [&_p]:leading-relaxed [&_p]:my-2 [&_p]:text-text-secondary",
        // Lists
        "[&_ul]:my-2 [&_ul]:pl-4 [&_ul]:list-disc [&_ul]:text-sm [&_ul]:text-text-secondary",
        "[&_ol]:my-2 [&_ol]:pl-4 [&_ol]:list-decimal [&_ol]:text-sm [&_ol]:text-text-secondary",
        "[&_li]:my-0.5",
        // Code
        "[&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:text-xs [&_code]:font-mono [&_code]:text-accent",
        "[&_pre]:my-2 [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:overflow-x-auto",
        "[&_pre_code]:p-0 [&_pre_code]:bg-transparent",
        // Links
        "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-accent/80",
        // Blockquotes
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground [&_blockquote]:italic",
        // Strong and emphasis
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_em]:italic",
        // Horizontal rules
        "[&_hr]:my-4 [&_hr]:border-border",
        className
      )}
      dangerouslySetInnerHTML={{ __html: rendered }}
      data-ui-lint
    />
  );
}

/**
 * Parse markdown to HTML
 * Handles: headings, bold, italic, code blocks, inline code, links, lists, blockquotes, hr
 */
function parseMarkdown(markdown: string): string {
  if (!markdown) return "";

  let html = markdown;

  // Escape HTML entities first (security)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (``` ... ```) - process first to avoid conflicts
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code (`code`) - but not inside code blocks
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Headings (must be at start of line)
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr>");
  html = html.replace(/^\*\*\*+$/gm, "<hr>");

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, "\n");

  // Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Italic (*text* or _text_) - be careful not to match ** or __
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>");

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Unordered lists (- item or * item)
  html = html.replace(/^[\-\*] (.+)$/gm, "<li>$1</li>");
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists (1. item)
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  // Note: This simplified version doesn't distinguish ol from ul after wrapping
  // A more complete solution would track list type

  // Paragraphs - wrap remaining text blocks
  // Split by double newlines, wrap non-block elements
  const blocks = html.split(/\n\n+/);
  html = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // Don't wrap if it's already a block element
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<hr")
      ) {
        return trimmed;
      }
      // Wrap in paragraph, converting single newlines to <br>
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}
