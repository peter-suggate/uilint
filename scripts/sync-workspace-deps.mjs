import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const PACKAGES_DIR = path.join(ROOT, "packages");

// Note: We intentionally keep internal deps as "workspace:*" (except peers)
// so local monorepo development always links to the latest workspace version.

function readJSON(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function writeJSON(filePath, obj) {
  const next = JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(filePath, next, "utf-8");
}

function listWorkspacePackages() {
  if (!fs.existsSync(PACKAGES_DIR)) return [];
  const entries = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true });
  const pkgs = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const pkgJsonPath = path.join(PACKAGES_DIR, ent.name, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;
    const pkg = readJSON(pkgJsonPath);
    if (!pkg?.name || !pkg?.version) continue;
    pkgs.push({
      dir: ent.name,
      path: pkgJsonPath,
      name: pkg.name,
      version: pkg.version,
    });
  }
  return pkgs;
}

function syncDepsForPackage(pkgJson, versionsByName) {
  const sections = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];
  let changed = false;

  for (const section of sections) {
    const deps = pkgJson[section];
    if (!deps || typeof deps !== "object") continue;

    for (const [depName, depRange] of Object.entries(deps)) {
      const internalVersion = versionsByName.get(depName);
      if (!internalVersion) continue;

      // Prefer pnpm's workspace protocol for internal packages so local dev always
      // links to the workspace copy (and doesn't get pinned to specific versions).
      //
      // Keep peerDependencies versioned by default to preserve published
      // compatibility constraints.
      const desired =
        section === "peerDependencies" ? `^${internalVersion}` : "workspace:*";

      // If the user has already opted into a workspace protocol, don't rewrite it
      // (e.g. workspace:^, workspace:~, workspace:*, etc).
      if (typeof depRange === "string" && depRange.startsWith("workspace:")) {
        continue;
      }
      if (depRange !== desired) {
        deps[depName] = desired;
        changed = true;
      }
    }
  }

  return changed;
}

const workspacePkgs = listWorkspacePackages();
const versionsByName = new Map(workspacePkgs.map((p) => [p.name, p.version]));

let filesChanged = 0;

for (const pkg of workspacePkgs) {
  const pkgJson = readJSON(pkg.path);
  const changed = syncDepsForPackage(pkgJson, versionsByName);
  if (changed) {
    writeJSON(pkg.path, pkgJson);
    filesChanged += 1;
  }
}

if (filesChanged > 0) {
  // eslint-disable-next-line no-console
  console.log(
    `sync-workspace-deps: updated ${filesChanged} package.json file(s)`
  );
} else {
  // eslint-disable-next-line no-console
  console.log("sync-workspace-deps: no changes");
}
