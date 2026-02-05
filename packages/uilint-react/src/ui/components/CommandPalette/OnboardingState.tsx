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
import { cn } from "../../../lib/utils";

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
      className={cn(
        "px-2 py-1.5 border-none rounded-md cursor-pointer flex items-center justify-center transition-colors duration-200",
        copied ? "bg-success text-white" : "bg-[rgba(128,128,128,0.15)] text-text-secondary"
      )}
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
      className="flex items-center gap-2 px-3.5 py-3 bg-surface-elevated rounded-[10px] border border-border mt-5"
    >
      <Terminal size={15} className="text-text-muted shrink-0" />
      <code className="flex-1 text-sm font-mono text-text-primary tracking-tight font-medium">
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
      className="mt-4 px-5 py-2.5 text-[13px] font-medium text-text-secondary bg-transparent border border-border rounded-[10px] cursor-pointer flex items-center gap-2"
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
      className="flex flex-col items-center justify-center px-8 py-12 text-center min-h-[260px]"
    >
      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.2, ease: crispEase }}
        className="m-0 text-base font-semibold text-text-primary tracking-tight"
      >
        {content.title}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2, ease: crispEase }}
        className="mt-2.5 mb-0 mx-0 text-sm text-text-muted leading-normal max-w-[320px]"
      >
        {content.subtitle}
      </motion.p>

      <CommandBox command={content.command} />

      {content.showRetry && <RetryButton onClick={retryConnection} />}
    </motion.div>
  );
}

export default OnboardingState;
