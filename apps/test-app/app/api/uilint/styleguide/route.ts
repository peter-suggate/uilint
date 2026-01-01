import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const STYLEGUIDE_DIR = ".uilint";
const STYLEGUIDE_FILE = "styleguide.md";

function getStyleGuidePath(): string {
  return join(process.cwd(), STYLEGUIDE_DIR, STYLEGUIDE_FILE);
}

export async function GET() {
  const stylePath = getStyleGuidePath();

  try {
    if (!existsSync(stylePath)) {
      return NextResponse.json({ exists: false, content: null });
    }

    const content = await readFile(stylePath, "utf-8");
    return NextResponse.json({ exists: true, content });
  } catch (error) {
    console.error("[UILint API] Error reading style guide:", error);
    return NextResponse.json({ exists: false, content: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const dirPath = join(process.cwd(), STYLEGUIDE_DIR);
    const stylePath = getStyleGuidePath();

    // Ensure directory exists
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }

    // Write the file
    await writeFile(stylePath, content, "utf-8");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[UILint API] Error saving style guide:", error);
    return NextResponse.json(
      { error: "Failed to save style guide" },
      { status: 500 }
    );
  }
}
