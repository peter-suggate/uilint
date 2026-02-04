/**
 * OnboardingState - Setup instructions when UILint server is not connected
 *
 * Shows clear, simple instructions for how to start the UILint server using npx.
 * Focused on getting users up and running quickly.
 */
import React, { useState, useCallback } from "react";
import { motion } from "motion/react";
import { Terminal, Copy, Check, RefreshCw } from "lucide-react";
import { useComposedStore } from "../../../core/store";

// Crisp easing curve matching the design system
const crispEase = [0.32, 0.72, 0, 1] as const;

type OnboardingVariant = "disconnected" | "manifest-error";

interface OnboardingStateProps {
  variant: OnboardingVariant;
}

/**
 * Copy button with feedback
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <motion.button
      onClick={handleCopy}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{
        padding: "6px 8px",
        background: copied ? "var(--uilint-success)" : "rgba(128, 128, 128, 0.15)",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: copied ? "#fff" : "var(--uilint-text-secondary)",
        transition: "background 0.2s ease, color 0.2s ease",
      }}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </motion.button>
  );
}

/**
 * Command box with copy functionality
 */
function CommandBox({ command }: { command: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.2, ease: crispEase }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 14px",
        background: "var(--uilint-surface-elevated, rgba(0, 0, 0, 0.03))",
        borderRadius: 10,
        border: "1px solid var(--uilint-border)",
        marginTop: 20,
      }}
    >
      <Terminal size={15} style={{ color: "var(--uilint-text-muted)", flexShrink: 0 }} />
      <code
        style={{
          flex: 1,
          fontSize: 14,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          color: "var(--uilint-text-primary)",
          letterSpacing: "-0.01em",
          fontWeight: 500,
        }}
      >
        {command}
      </code>
      <CopyButton text={command} />
    </motion.div>
  );
}

/**
 * Retry button - simple secondary style
 */
function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.2, ease: crispEase }}
      style={{
        marginTop: 16,
        padding: "10px 20px",
        fontSize: 13,
        fontWeight: 500,
        color: "var(--uilint-text-secondary)",
        background: "transparent",
        border: "1px solid var(--uilint-border)",
        borderRadius: 10,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <RefreshCw size={14} />
      Try again
    </motion.button>
  );
}

/**
 * OnboardingState - Main component
 *
 * Simple, focused onboarding that shows users how to get started.
 */
export function OnboardingState({ variant }: OnboardingStateProps) {
  const retryConnection = useComposedStore((s) => s.retryConnection);
  const connectionStatus = useComposedStore((s) => s.connectionStatus);

  const content = React.useMemo(() => {
    switch (variant) {
      case "disconnected":
        return {
          title: "Get started with UILint",
          subtitle: "Run this command in your project directory:",
          command: "npx uilint serve",
          showRetry: connectionStatus.mode === "websocket",
        };
      case "manifest-error":
        return {
          title: "Build lint manifest",
          subtitle: "Generate a lint report for your project:",
          command: "npx uilint build",
          showRetry: false,
        };
    }
  }, [variant, connectionStatus.mode]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: crispEase }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 32px",
        textAlign: "center",
        minHeight: 260,
      }}
    >
      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.2, ease: crispEase }}
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: "var(--uilint-text-primary)",
          letterSpacing: "-0.02em",
        }}
      >
        {content.title}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2, ease: crispEase }}
        style={{
          margin: "10px 0 0 0",
          fontSize: 14,
          color: "var(--uilint-text-muted)",
          lineHeight: 1.5,
          maxWidth: 320,
        }}
      >
        {content.subtitle}
      </motion.p>

      <CommandBox command={content.command} />

      {content.showRetry && <RetryButton onClick={retryConnection} />}
    </motion.div>
  );
}

export default OnboardingState;
