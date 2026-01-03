"use client";

import React, { useState } from "react";
import { useUILint } from "./UILint";
import type { UILintIssue } from "uilint-core";

interface StyleQuestion {
  id: string;
  question: string;
  options: {
    value: string;
    label: string;
    preview?: React.ReactNode;
  }[];
  context?: string;
}

export function QuestionPanel() {
  const { issues } = useUILint();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Generate questions from issues
  const questions = generateQuestionsFromIssues(issues);

  if (questions.length === 0) {
    return (
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          color: "#9CA3AF",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎯</div>
        <div style={{ fontSize: "14px" }}>No style conflicts to resolve</div>
        <div style={{ fontSize: "12px", marginTop: "4px" }}>
          Scan the page to detect inconsistencies
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswer = (value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));

    // Move to next question or finish
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleSaveToStyleGuide = async () => {
    console.log("[UILint] Saving preferences:", answers);
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      // Fetch existing style guide
      const getResponse = await fetch("/api/.uilint/styleguide");
      const data = await getResponse.json().catch(() => ({}));

      if (!getResponse.ok || !data?.exists || !data?.content) {
        throw new Error(
          data?.error ||
            'No style guide found. Create ".uilint/styleguide.md" at your workspace root first.'
        );
      }

      // Build updated style guide content
      const updatedContent = applyAnswersToStyleGuide(data.content, answers);

      // Save to style guide
      const postResponse = await fetch("/api/.uilint/styleguide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: updatedContent }),
      });

      if (!postResponse.ok) {
        const err = await postResponse.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save style guide");
      }

      console.log("[UILint] Style guide saved successfully!");
      setSaveSuccess(true);

      // Reset state after a short delay to show success
      setTimeout(() => {
        setAnswers({});
        setCurrentQuestionIndex(0);
        setSaveSuccess(false);
      }, 1500);
    } catch (error) {
      console.error("[UILint] Error saving style guide:", error);
      setSaveError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const isComplete = Object.keys(answers).length === questions.length;

  return (
    <div style={{ padding: "16px" }}>
      {/* Progress */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <span style={{ fontSize: "12px", color: "#9CA3AF" }}>
          Question {currentQuestionIndex + 1} of {questions.length}
        </span>
        <div
          style={{
            width: "100px",
            height: "4px",
            backgroundColor: "#374151",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${
                ((currentQuestionIndex + 1) / questions.length) * 100
              }%`,
              height: "100%",
              backgroundColor: "#3B82F6",
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      {/* Question */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: "500",
            color: "#F3F4F6",
            marginBottom: "8px",
          }}
        >
          {currentQuestion.question}
        </div>
        {currentQuestion.context && (
          <div
            style={{
              fontSize: "12px",
              color: "#9CA3AF",
              marginBottom: "12px",
            }}
          >
            {currentQuestion.context}
          </div>
        )}
      </div>

      {/* Options */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {currentQuestion.options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleAnswer(option.value)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              backgroundColor:
                answers[currentQuestion.id] === option.value
                  ? "#374151"
                  : "#111827",
              border:
                answers[currentQuestion.id] === option.value
                  ? "1px solid #3B82F6"
                  : "1px solid #374151",
              borderRadius: "8px",
              color: "#F3F4F6",
              fontSize: "13px",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {option.preview && (
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {option.preview}
              </div>
            )}
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "16px",
        }}
      >
        <button
          onClick={() =>
            setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
          }
          disabled={currentQuestionIndex === 0}
          style={{
            padding: "8px 16px",
            backgroundColor: "transparent",
            border: "1px solid #374151",
            borderRadius: "6px",
            color: currentQuestionIndex === 0 ? "#4B5563" : "#9CA3AF",
            fontSize: "12px",
            cursor: currentQuestionIndex === 0 ? "not-allowed" : "pointer",
          }}
        >
          ← Back
        </button>

        {isComplete && (
          <button
            onClick={handleSaveToStyleGuide}
            disabled={isSaving}
            style={{
              padding: "8px 16px",
              backgroundColor: saveSuccess
                ? "#059669"
                : isSaving
                ? "#6B7280"
                : "#10B981",
              border: "none",
              borderRadius: "6px",
              color: "white",
              fontSize: "12px",
              fontWeight: "500",
              cursor: isSaving ? "wait" : "pointer",
              opacity: isSaving ? 0.8 : 1,
              transition: "all 0.2s",
            }}
          >
            {saveSuccess
              ? "✓ Saved!"
              : isSaving
              ? "Saving..."
              : "Save to Style Guide"}
          </button>
        )}
      </div>

      {saveError && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px",
            borderRadius: "8px",
            backgroundColor: "#7F1D1D",
            border: "1px solid #EF4444",
            color: "#FEE2E2",
            fontSize: "12px",
            lineHeight: 1.4,
          }}
        >
          {saveError}
        </div>
      )}
    </div>
  );
}

function generateQuestionsFromIssues(issues: UILintIssue[]): StyleQuestion[] {
  const questions: StyleQuestion[] = [];

  // Group color issues
  const colorIssues = issues.filter((i) => i.type === "color");
  if (colorIssues.length > 0) {
    const colors = new Set<string>();
    colorIssues.forEach((issue) => {
      if (issue.currentValue) colors.add(issue.currentValue);
      if (issue.expectedValue) colors.add(issue.expectedValue);
    });

    if (colors.size >= 2) {
      const colorArray = Array.from(colors);
      questions.push({
        id: "primary-color",
        question: "Which color should be used as the primary color?",
        context:
          "Multiple similar colors were detected. Choose one for consistency.",
        options: colorArray.slice(0, 4).map((color) => ({
          value: color,
          label: color,
          preview: (
            <div
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: color,
                borderRadius: "4px",
              }}
            />
          ),
        })),
      });
    }
  }

  // Group spacing issues
  const spacingIssues = issues.filter((i) => i.type === "spacing");
  if (spacingIssues.length > 0) {
    questions.push({
      id: "spacing-scale",
      question: "What spacing scale should be used?",
      context: "Choose a base unit for consistent spacing throughout the UI.",
      options: [
        { value: "4", label: "4px base (4, 8, 12, 16, 20, 24...)" },
        { value: "8", label: "8px base (8, 16, 24, 32, 40...)" },
        {
          value: "tailwind",
          label: "Tailwind scale (4, 8, 12, 16, 20, 24...)",
        },
      ],
    });
  }

  // Group typography issues
  const typographyIssues = issues.filter((i) => i.type === "typography");
  if (typographyIssues.length > 0) {
    questions.push({
      id: "font-weights",
      question: "Which font weights should be used?",
      context: "Select the weights to use for consistency.",
      options: [
        {
          value: "400-600-700",
          label: "Regular (400), Semibold (600), Bold (700)",
        },
        {
          value: "400-500-700",
          label: "Regular (400), Medium (500), Bold (700)",
        },
        {
          value: "300-400-600",
          label: "Light (300), Regular (400), Semibold (600)",
        },
      ],
    });
  }

  return questions;
}

/**
 * Applies user answers to an existing style guide markdown string.
 *
 * NOTE: We do not auto-generate new style guides. If required sections are
 * missing, we throw with a clear message.
 */
function applyAnswersToStyleGuide(
  existingContent: string,
  answers: Record<string, string>
): string {
  let content = existingContent;

  if (answers["primary-color"]) {
    content = upsertBulletInSection(
      content,
      "Colors",
      "Primary",
      answers["primary-color"]
    );
  }

  if (answers["font-weights"]) {
    const weightMap: Record<string, string> = {
      "400-600-700": "400 (Regular), 600 (Semibold), 700 (Bold)",
      "400-500-700": "400 (Regular), 500 (Medium), 700 (Bold)",
      "300-400-600": "300 (Light), 400 (Regular), 600 (Semibold)",
    };
    const value = weightMap[answers["font-weights"]] || answers["font-weights"];
    content = upsertBulletInSection(
      content,
      "Typography",
      "Font Weights",
      value
    );
  }

  if (answers["spacing-scale"]) {
    const spacingMap: Record<string, string> = {
      "4": "4px (4, 8, 12, 16, 20, 24, 32, 40, 48...)",
      "8": "8px (8, 16, 24, 32, 40, 48, 56, 64...)",
      tailwind: "Tailwind (4, 8, 12, 16, 20, 24, 32, 40, 48...)",
    };
    const value =
      spacingMap[answers["spacing-scale"]] || answers["spacing-scale"];
    content = upsertBulletInSection(content, "Spacing", "Base unit", value);
  }

  return content;
}

/**
 * Extracts lines from a specific section of the markdown
 */
function extractSection(content: string | null, sectionName: string): string[] {
  if (!content) return [];

  const lines = content.split("\n");
  const sectionStart = lines.findIndex((line) =>
    line.match(new RegExp(`^##\\s+${sectionName}`, "i"))
  );

  if (sectionStart === -1) return [];

  const result: string[] = [];
  for (let i = sectionStart + 1; i < lines.length; i++) {
    const line = lines[i];
    // Stop at next section
    if (line.startsWith("## ")) break;
    // Skip empty lines at start
    if (result.length === 0 && line.trim() === "") continue;
    // Include list items
    if (line.startsWith("- ")) {
      result.push(line);
    }
  }

  return result;
}

function upsertBulletInSection(
  markdown: string,
  sectionName: string,
  label: string,
  value: string
): string {
  const lines = markdown.split("\n");
  const sectionStart = lines.findIndex((line) =>
    line.match(new RegExp(`^##\\s+${sectionName}\\s*$`, "i"))
  );
  if (sectionStart === -1) {
    throw new Error(
      `Style guide is missing section "## ${sectionName}". Add it to your style guide and try again.`
    );
  }

  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      sectionEnd = i;
      break;
    }
  }

  const bulletRe = new RegExp(
    `^-\\s+\\*\\*${escapeRegExp(label)}\\*\\*:\\s+.*$`
  );
  const newBullet = `- **${label}**: ${value}`;

  // Try replace first
  for (let i = sectionStart + 1; i < sectionEnd; i++) {
    if (bulletRe.test(lines[i])) {
      lines[i] = newBullet;
      return lines.join("\n");
    }
  }

  // Otherwise insert right after the section header + any immediate blank lines
  let insertAt = sectionStart + 1;
  while (insertAt < sectionEnd && lines[insertAt].trim() === "") insertAt++;
  lines.splice(insertAt, 0, newBullet);
  return lines.join("\n");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
