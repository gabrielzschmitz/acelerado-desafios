// Sync the canonical markdown sources (root README.md, SUBMISSION.md, every
// YYYY-MM-<slug>/README.md and its example/ + reference/ READMEs) into
// Starlight's content collection at src/content/docs/.
//
// The repo's source-of-truth stays in <challenge>/README.md so GitHub keeps
// rendering it natively. This script is just a copy-with-frontmatter step
// that runs on every dev/build (npm scripts predev/prebuild).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'src', 'content', 'docs');
const CHALLENGE_RE = /^\d{4}-\d{2}-[a-z0-9-]+$/;
// Mirror of `base` in astro.config.mjs. Used when rewriting GitHub-style
// relative links in the source Markdown into absolute site URLs - Astro
// doesn't auto-prepend the base to bare absolute paths in markdown links,
// so we have to bake it in. Keep in sync with astro.config.mjs.
const BASE = '/acelerado-desafios';

async function main() {
  const challenges = await discoverChallenges();
  // src/content/docs/ is gitignored (its contents are synced from the
  // source-of-truth markdown). On a fresh CI checkout the directory
  // doesn't exist yet, so create it before we write the landing/submission.
  await fs.mkdir(DOCS, { recursive: true });
  await fs.rm(path.join(DOCS, 'desafios'), { recursive: true, force: true });
  await fs.rm(path.join(DOCS, 'submission.md'), { force: true });
  await fs.rm(path.join(DOCS, 'index.mdx'), { force: true });

  // Persist the challenges list first - the landing imports it.
  await writeChallengeIndex(challenges);

  await syncLanding();
  await syncSubmission();
  for (const c of challenges) {
    await syncChallenge(c);
  }

  console.log(
    `Synced landing + SUBMISSION.md + ${challenges.length} challenge(s)`,
  );
}

async function discoverChallenges() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || !CHALLENGE_RE.test(e.name)) continue;
    const dir = path.join(ROOT, e.name);
    const readme = path.join(dir, 'README.md');
    try { await fs.access(readme); } catch { continue; }
    const spec = await readJsonOrNull(path.join(dir, 'spec.json'));
    out.push({
      slug: e.name,
      dir,
      spec: spec ?? {},
      title: spec?.title ?? (await firstHeading(readme)) ?? e.name,
      month: spec?.month ?? e.name.slice(0, 7),
      primaryMetric: spec?.primary_metric ?? '',
      direction: spec?.direction ?? '',
      hasExample: await exists(path.join(dir, 'example', 'README.md')),
      hasReference: await exists(path.join(dir, 'reference', 'README.md')),
      hasComeceAqui: await exists(path.join(dir, 'comece-aqui', 'README.md')),
    });
  }
  out.sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));
  return out;
}

async function syncLanding() {
  // The root README.md is the source of truth. Drop the H1 (Starlight
  // renders it from frontmatter) and replace the "Desafio atual" +
  // "Histórico" sections with a single "## Desafios" + auto ChallengeCard
  // grid populated from the discovered challenges.
  const src = path.join(ROOT, 'README.md');
  const raw = await fs.readFile(src, 'utf8');
  const noH1 = stripFirstH1(raw);
  const linked = rewriteLandingLinks(noH1);
  const replaced = replaceChallengesSection(linked);

  const fm = frontmatter({
    title: 'acelerado-desafios',
    description:
      'Desafios mensais de performance da Comunidade do Desempenho.',
    template: 'doc',
    tableOfContents: false,
    sidebar: { hidden: true }, // already linked as "Início" in astro.config
    pagefind: false,
  });

  const imports = [
    "import Hero from '../../components/Hero.astro';",
    "import ChallengeCard from '../../components/ChallengeCard.astro';",
    "import DiscordCTA from '../../components/DiscordCTA.astro';",
    "import challenges from '../../data/challenges.json';",
    '',
  ].join('\n');

  // Hero block goes ABOVE the synced README body. The intro paragraphs in
  // the README still convey the project pitch in plain text (visible on
  // GitHub); the hero is the site-only brand surface.
  const hero = '<Hero />\n\n';

  await fs.writeFile(path.join(DOCS, 'index.mdx'), fm + imports + '\n' + hero + replaced);
}

function replaceChallengesSection(body) {
  // The README has a "## Desafios" section with a markdown table listing
  // every challenge. On the site we replace the body of that section (the
  // table) with an auto-rendered <ChallengeCard> grid, keeping the heading.
  const grid = [
    '## Desafios',
    '',
    '<div class="challenge-grid">',
    '  {challenges.map((c) => (',
    '    <ChallengeCard',
    '      href={`./desafios/${c.slug}/`}',
    '      month={c.month}',
    '      title={c.title}',
    '      primaryMetric={c.primaryMetric}',
    '      direction={c.direction}',
    '      status="aberto"',
    '    />',
    '  ))}',
    '  <ChallengeCard',
    '    placeholder',
    '    month={(() => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 7); })()}',
    '    title="próximo desafio"',
    '    status="aguardando"',
    '  />',
    '</div>',
    '',
    '<DiscordCTA />',
  ].join('\n');

  // Match "## Desafios" + body up to (but not including) the next H2.
  const re = /^##\s+Desafios\b[\s\S]*?(?=^##\s+)/m;
  if (re.test(body)) return body.replace(re, grid + '\n\n');

  // Fallback: append the grid at the end if the section is missing/last.
  return body + '\n\n' + grid + '\n';
}

async function syncSubmission() {
  const src = path.join(ROOT, 'SUBMISSION.md');
  const raw = await fs.readFile(src, 'utf8');
  const body = stripFirstH1(raw);
  const fm = frontmatter({
    title: 'Como submeter uma solução',
    description: 'Estrutura de diretórios, meta.json e fluxo de PR.',
    sidebar: { order: 1 },
  });
  await fs.writeFile(path.join(DOCS, 'submission.md'), fm + body);
}

async function syncChallenge(c) {
  const outDir = path.join(DOCS, 'desafios', c.slug);
  await fs.mkdir(outDir, { recursive: true });

  // ---- main page (index.md) ----
  const readme = await fs.readFile(path.join(c.dir, 'README.md'), 'utf8');
  const body = rewriteChallengeLinks(stripFirstH1(readme));
  const fm = frontmatter({
    title: c.title,
    description: `Desafio ${c.slug}: ${c.title}`,
    sidebar: { label: c.month + ' · ' + shortTitle(c.title) },
    metricStrip: pickStripData(c.spec),
    challengeMonth: c.month,
    primaryMetric: c.primaryMetric,
    direction: c.direction,
  });
  await fs.writeFile(path.join(outDir, 'index.md'), fm + body);

  // ---- example/ + reference/ subpages ----
  for (const sub of ['example', 'reference', 'comece-aqui']) {
    const subMd = path.join(c.dir, sub, 'README.md');
    if (!(await exists(subMd))) continue;
    const raw = await fs.readFile(subMd, 'utf8');
    const subBody = stripFirstH1(raw);
    const subTitle = (await firstHeading(subMd)) ?? sub;
    const subFm = frontmatter({
      title: subTitle,
      description: `${subTitle} - ${c.title}`,
      sidebar: { order: sub === 'example' ? 3 : 4 },
    });
    // rewrite relative links from the sub/ dir back up to the challenge root
    // (e.g. `../README.md` -> `./` for our slug)
    const rewritten = rewriteRelativeLinks(subBody, sub, c.slug);
    await fs.writeFile(path.join(outDir, `${sub}.md`), subFm + rewritten);
  }

  // ---- copy any image/asset folder the README references ----
  for (const assetDir of ['docs']) {
    const src = path.join(c.dir, assetDir);
    if (await exists(src)) {
      await copyDir(src, path.join(outDir, assetDir));
    }
  }
}

async function writeChallengeIndex(challenges) {
  const out = challenges.map((c) => ({
    slug: c.slug,
    title: c.title,
    shortTitle: shortTitle(c.title),
    month: c.month,
    primaryMetric: c.primaryMetric,
    direction: c.direction,
    hasExample: c.hasExample,
    hasReference: c.hasReference,
    hasComeceAqui: c.hasComeceAqui,
  }));
  await fs.mkdir(path.join(ROOT, 'src', 'data'), { recursive: true });
  await fs.writeFile(
    path.join(ROOT, 'src', 'data', 'challenges.json'),
    JSON.stringify(out, null, 2) + '\n',
  );
}

// ---- helpers ----------------------------------------------------------

function frontmatter(obj) {
  // Compact, deterministic YAML for the small set of types we use here.
  return '---\n' + toYaml(obj) + '---\n\n';
}

function toYaml(value, indent = 0) {
  const pad = '  '.repeat(indent);
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value.map((v) => `${pad}- ${toYaml(v, indent + 1).trimStart()}`).join('\n');
  }
  if (typeof value === 'object') {
    const lines = [];
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        lines.push(`${pad}${k}:`);
        lines.push(indentBlock(toYaml(v, indent + 1), indent + 1));
      } else if (Array.isArray(v)) {
        lines.push(`${pad}${k}:`);
        lines.push(toYaml(v, indent + 1));
      } else {
        lines.push(`${pad}${k}: ${toYaml(v, indent + 1)}`);
      }
    }
    return lines.join('\n') + (indent === 0 ? '\n' : '');
  }
  return JSON.stringify(value);
}

function indentBlock(s, indent) {
  const pad = '  '.repeat(indent);
  return s.split('\n').map((l) => (l ? pad + l : l)).join('\n');
}

function stripFirstH1(raw) {
  const lines = raw.split('\n');
  const out = [];
  let seen = false;
  for (const line of lines) {
    if (!seen && /^#\s+/.test(line)) {
      seen = true;
      // drop the title - Starlight already renders it from frontmatter
      continue;
    }
    out.push(line);
  }
  return out.join('\n').replace(/^\n+/, '');
}

async function firstHeading(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^#\s+(.+)$/);
      if (m) return m[1].trim();
    }
  } catch {}
  return null;
}

function shortTitle(t) {
  // For sidebar labels: take the part after " - " if present.
  const i = t.indexOf(' - ');
  return i >= 0 ? t.slice(i + 3) : t;
}

function pickStripData(spec) {
  if (!spec || Object.keys(spec).length === 0) return null;
  return {
    primaryMetric: spec.primary_metric ?? null,
    direction: spec.direction ?? null,
    validationMinDb:
      spec.validation?.metric === 'psnr' && typeof spec.validation?.min_db === 'number'
        ? spec.validation.min_db
        : null,
    capTimeMs: spec.caps?.time_ms_per_image ?? null,
    capRssMb: spec.caps?.peak_rss_mb ?? null,
    measuredRuns: spec.bench?.measured_runs ?? null,
    warmupRuns: spec.bench?.warmup_runs ?? null,
  };
}

function rewriteRelativeLinks(body, sub, slug) {
  // From <slug>/<sub>/README.md, `../README.md` points to <slug>/README.md
  // which we map to the parent directory in the synced tree (./).
  // Rewrite a few common patterns; everything else falls through to GitHub
  // via Starlight's link checker if broken.
  return body
    .replace(/\]\(\.\.\/README\.md([^\)]*)\)/g, '](../$1)')
    .replace(/\]\(\.\.\/SUBMISSION\.md([^\)]*)\)/g, '](/submission/$1)');
}

// Rewrite GitHub-friendly relative links in the root README so they
// resolve on the synced landing page. The README's source-of-truth form
// (e.g. `[SUBMISSION.md](SUBMISSION.md)`) is the right thing on GitHub
// but becomes `/acelerado-desafios/SUBMISSION.md` on the site, which
// 404s. Rewrite to absolute site URLs with the base prefix baked in.
function rewriteLandingLinks(body) {
  return body
    .replace(/\]\(SUBMISSION\.md([^\)]*)\)/g, `](${BASE}/submission/$1)`)
    .replace(/\]\(LICENSE\)/g, '](https://github.com/wainejr/acelerado-desafios/blob/main/LICENSE)');
}

// Same idea for a challenge's main README. The contestant writes
// `[../SUBMISSION.md]` and `[comece-aqui.md]` (both correct on GitHub
// from <slug>/README.md) - rewrite to URLs that work on the site.
//   - SUBMISSION.md lives at the docs root, base prefix needed.
//   - comece-aqui.md is a synced sub-page next to the challenge index;
//     a relative URL is enough and the browser resolves it correctly.
function rewriteChallengeLinks(body) {
  return body
    .replace(/\]\(\.\.\/SUBMISSION\.md([^\)]*)\)/g, `](${BASE}/submission/$1)`);
}

async function readJsonOrNull(p) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
