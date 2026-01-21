#!/usr/bin/env node

// Check Node.js version BEFORE any imports that might fail on older versions.
// This file uses only syntax compatible with Node 14+ to provide a clear error message.

const MIN_MAJOR = 20;
const MIN_MINOR = 19;

const ver = process.versions.node || "";
const parts = ver.split(".");
const major = parseInt(parts[0], 10);
const minor = parseInt(parts[1], 10);

const ok =
  !isNaN(major) &&
  !isNaN(minor) &&
  (major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR));

if (!ok) {
  console.error(
    `\n  ✗ uilint requires Node.js v${MIN_MAJOR}.${MIN_MINOR}.0 or higher.\n` +
    `    You are running Node.js v${ver}.\n\n` +
    `    Please upgrade Node.js: https://nodejs.org/\n`
  );
  process.exit(1);
}

// Node version is OK, load the actual CLI
import("../dist/index.js");
