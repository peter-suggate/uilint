"use client";

import React, { useState } from "react";
import { useUILint } from "./UILint";

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

    try {
      // Fetch existing style guide
      const getResponse = await fetch("/api/uilint/styleguide");
      const { exists, content: existingContent } = await getResponse.json();

      // Build updated style guide content
      const updatedContent = buildUpdatedStyleGuide(
        exists ? existingContent : null,
        answers
      );

      // Save to style guide
      const postResponse = await fetch("/api/uilint/styleguide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: updatedContent }),
      });

      if (!postResponse.ok) {
        throw new Error("Failed to save style guide");
      }

      console.log("[UILint] Style guide saved successfully!");

      // Reset state after save
      setAnswers({});
      setCurrentQuestionIndex(0);
    } catch (error) {
      console.error("[UILint] Error saving style guide:", error);
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
            style={{
              padding: "8px 16px",
              backgroundColor: "#10B981",
              border: "none",
              borderRadius: "6px",
              color: "white",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Save to Style Guide
          </button>
        )}
      </div>
    </div>
  );
}

function generateQuestionsFromIssues(
  issues: typeof import("../types").UILintIssue[]
): StyleQuestion[] {
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
