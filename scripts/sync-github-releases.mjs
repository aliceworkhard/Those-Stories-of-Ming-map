#!/usr/bin/env node
/**
 * Parses `CHANGELOG.md` sections (`## [vX.Y.Z] — YYYY-MM-DD · Title`) and
 * creates or updates corresponding GitHub Releases via `gh release`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const changelogPath = path.resolve(process.cwd(), 'CHANGELOG.md');
const raw = fs.readFileSync(changelogPath, 'utf8');

const headerRegex = /^## \[(v\d+\.\d+\.\d+)\]\s*[—-]\s*([^\r\n]+)$/gm;
const matches = [...raw.matchAll(headerRegex)];

if (matches.length === 0) {
  console.log('No release sections found in CHANGELOG.md.');
  process.exit(0);
}

// Get existing git tags in repo so we only publish releases for pushed tags
const existingTags = new Set(
  execFileSync('git', ['tag', '-l'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
);

// Process oldest -> newest so the highest semver becomes GitHub's "Latest" release!
const sections = matches
  .map((m, idx) => {
    const tag = m[1];
    const subtitle = m[2].trim();
    const start = m.index + m[0].length;
    const end = idx + 1 < matches.length ? matches[idx + 1].index : raw.length;
    const body = raw.slice(start, end).trim();
    return {
      tag,
      title: `${tag} · ${subtitle}`,
      body,
    };
  })
  .reverse();

for (const sec of sections) {
  if (!existingTags.has(sec.tag)) {
    console.log(`Skipping ${sec.tag} (git tag not pushed yet).`);
    continue;
  }

  const tmpFile = path.join(os.tmpdir(), `release-notes-${sec.tag}.md`);
  fs.writeFileSync(tmpFile, `${sec.body}\n`, 'utf8');

  let releaseExists = false;
  try {
    execFileSync('gh', ['release', 'view', sec.tag], { stdio: 'ignore' });
    releaseExists = true;
  } catch {
    releaseExists = false;
  }

  const isLatest = sec === sections[sections.length - 1];

  if (releaseExists) {
    console.log(`Updating existing GitHub Release ${sec.tag}...`);
    execFileSync(
      'gh',
      [
        'release',
        'edit',
        sec.tag,
        '--title',
        sec.title,
        '--notes-file',
        tmpFile,
        ...(isLatest ? ['--latest'] : []),
      ],
      { stdio: 'inherit' }
    );
  } else {
    console.log(`Creating new GitHub Release ${sec.tag}...`);
    execFileSync(
      'gh',
      [
        'release',
        'create',
        sec.tag,
        '--title',
        sec.title,
        '--notes-file',
        tmpFile,
        ...(isLatest ? ['--latest'] : ['--latest=false']),
      ],
      { stdio: 'inherit' }
    );
  }
}

console.log('GitHub Releases successfully synchronized with CHANGELOG.md!');
