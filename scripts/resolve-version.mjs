#!/usr/bin/env node
// Tag-driven versioning: the git tag (vX.Y.Z) is the single source of truth for
// the extension version. package.json's "version" field is only a placeholder;
// this script resolves the real version and (with --write) injects it into
// package.json at build time so `vsce package` picks it up.
//
// Resolution order:
//   1. RELEASE_TAG env (CD path, from the GitHub Release) — must be a strict
//      vX.Y.Z tag. Fails loudly otherwise so we never publish a bad version.
//   2. `git describe` on the nearest vX.Y.Z tag (local / CI path):
//        - exactly on a tag       -> X.Y.Z          (release build)
//        - N commits after a tag  -> X.Y.Z-dev.N    (dev / CI build)
//        - no matching tag yet    -> 0.0.0          (fresh repo)
//
// Only the resolved version is printed to stdout, so it is safe to capture with
// $(node scripts/resolve-version.mjs). Human-readable notes go to stderr.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function fromReleaseTag(tag) {
  const version = tag.replace(/^v/, '');
  if (!SEMVER.test(version)) {
    console.error(`::error::RELEASE_TAG "${tag}" must be a strict version tag like v1.2.3.`);
    process.exit(1);
  }
  return version;
}

function fromGit() {
  let described;
  try {
    described = execSync('git describe --tags --long --match "v[0-9]*.[0-9]*.[0-9]*"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // No matching tag in history yet — dev builds before the first release.
    return '0.0.0';
  }

  // `git describe --long` always yields "<tag>-<commits>-g<sha>", e.g. v0.0.2-3-g1a2b3c4.
  const match = described.match(/^v(\d+\.\d+\.\d+)-(\d+)-g[0-9a-f]+$/);
  if (!match) {
    console.error(`::error::Unexpected git describe output: ${described}`);
    process.exit(1);
  }
  const [, base, commits] = match;
  return Number(commits) === 0 ? base : `${base}-dev.${commits}`;
}

const version = process.env.RELEASE_TAG
  ? fromReleaseTag(process.env.RELEASE_TAG)
  : fromGit();

if (process.argv.includes('--write')) {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.error(`package.json version set to ${version}`);
}

console.log(version);
