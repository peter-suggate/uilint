export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { analyzeConsistency, type GroupedSnapshot } from "uilint-core";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { snapshot, model } = body as {
      snapshot: GroupedSnapshot;
      model?: string;
    };

    if (!snapshot) {
      return NextResponse.json(
        {
          error: "No snapshot provided",
          violations: [],
          elementCount: 0,
          analysisTime: 0,
        },
        { status: 400 }
      );
    }

    // Run consistency analysis using core function
    const result = await analyzeConsistency(snapshot, { model });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[UILint API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
        violations: [],
        elementCount: 0,
        analysisTime: 0,
      },
      { status: 500 }
    );
  }
}
