import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const DEFAULT_MODEL = "qwen2.5-coder:7b";

export async function POST(request: NextRequest) {
  try {
    const { styleSummary, styleGuide, generateGuide, model } =
      await request.json();

    const prompt = generateGuide
      ? buildStyleGuidePrompt(styleSummary)
      : buildAnalysisPrompt(styleSummary, styleGuide);

    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        prompt,
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to connect to Ollama" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const parsedResponse = parseResponse(data.response, generateGuide);

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error("[UILint API] Error:", error);
    return NextResponse.json(
      { error: "Analysis failed", issues: [] },
      { status: 500 }
    );
  }
}

function buildAnalysisPrompt(
  styleSummary: string,
  styleGuide: string | null
): string {
  const guideSection = styleGuide
    ? `## Current Style Guide\n${styleGuide}\n\n`
    : "## No Style Guide Found\nAnalyze the styles and identify inconsistencies.\n\n";

  return `You are a UI consistency analyzer. Analyze the following extracted styles and identify inconsistencies.

${guideSection}

${styleSummary}

Respond with a JSON object containing an "issues" array. Each issue should have:
- id: unique string identifier
- type: one of "color", "typography", "spacing", "component", "responsive", "accessibility"
- message: human-readable description of the issue
- currentValue: the problematic value found
- expectedValue: what it should be (if known from style guide)
- suggestion: how to fix it

Focus on:
1. Similar but not identical colors (e.g., #3B82F6 vs #3575E2)
2. Inconsistent font sizes or weights
3. Spacing values that don't follow a consistent scale
4. Mixed border-radius values

Be concise and actionable. Only report significant inconsistencies.

Example response:
{
  "issues": [
    {
      "id": "color-1",
      "type": "color",
      "message": "Found similar blue colors that should be consolidated",
      "currentValue": "#3575E2",
      "expectedValue": "#3B82F6",
      "suggestion": "Use the primary blue #3B82F6 consistently"
    }
  ]
}`;
}

function buildStyleGuidePrompt(styleSummary: string): string {
  return `You are a design system expert. Based on the following detected styles, generate a clean style guide.

${styleSummary}

Respond with a JSON object containing a "styleGuide" string in Markdown format with these sections:
- Colors (with semantic names)
- Typography (fonts, sizes, weights)
- Spacing (base unit and common values)
- Components (common patterns)

Example response:
{
  "styleGuide": "# UI Style Guide\\n\\n## Colors\\n- **Primary**: #3B82F6..."
}`;
}

function parseResponse(response: string, isStyleGuide: boolean): object {
  try {
    const parsed = JSON.parse(response);

    if (isStyleGuide) {
      return { styleGuide: parsed.styleGuide || null };
    }

    return { issues: parsed.issues || [] };
  } catch {
    console.error("[UILint API] Failed to parse LLM response:", response);
    return isStyleGuide ? { styleGuide: null } : { issues: [] };
  }
}
