import fs from 'node:fs';

const [basePath, headPath] = process.argv.slice(2);
const metrics = ['statements', 'branches', 'functions', 'lines'];
const tolerance = 0.001;

if (!basePath || !headPath) {
  console.error('Usage: node scripts/compare-coverage.mjs <base-summary.json> <head-summary.json>');
  process.exit(2);
}

const readSummary = (filePath) => {
  const summary = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!summary.total) {
    throw new Error(`Coverage summary is missing "total": ${filePath}`);
  }
  return summary.total;
};

const formatPct = (value) => `${value.toFixed(2)}%`;

const base = readSummary(basePath);
const head = readSummary(headPath);

const rows = metrics.map((metric) => {
  const basePct = Number(base[metric]?.pct);
  const headPct = Number(head[metric]?.pct);
  const delta = headPct - basePct;

  if (!Number.isFinite(basePct) || !Number.isFinite(headPct)) {
    throw new Error(`Coverage metric "${metric}" is missing or invalid.`);
  }

  return { metric, basePct, headPct, delta };
});

const regressions = rows.filter((row) => row.delta < -tolerance);

const markdown = [
  '## E2E Coverage Comparison',
  '',
  '| Metric | Base | PR | Delta |',
  '| --- | ---: | ---: | ---: |',
  ...rows.map(
    ({ metric, basePct, headPct, delta }) =>
      `| ${metric} | ${formatPct(basePct)} | ${formatPct(headPct)} | ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}% |`,
  ),
  '',
  regressions.length === 0
    ? 'Coverage check passed: no aggregate e2e coverage metric decreased.'
    : `Coverage check failed: ${regressions.map((row) => row.metric).join(', ')} decreased.`,
  '',
].join('\n');

console.log(markdown);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}

if (regressions.length > 0) {
  process.exit(1);
}
