import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { EvaluationReport, TestCaseResult } from "../evaluate.js";

export interface SuiteReport {
  name: string;
  report: EvaluationReport;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreClass(success: boolean): string {
  return success ? "pass" : "fail";
}

function renderCase(tc: TestCaseResult): string {
  const mark = tc.success ? "PASS" : "FAIL";
  const rows = tc.metrics
    .map((m) => {
      const thr =
        m.threshold === null || m.threshold === undefined
          ? "—"
          : m.threshold.toFixed(2);
      const reason = m.reason
        ? `<div class="reason">${esc(m.reason.split("\n")[0] ?? "")}</div>`
        : "";
      const err = m.error
        ? `<div class="error">${esc(m.error)}</div>`
        : "";
      return `<tr class="${scoreClass(m.success)}">
        <td>${m.success ? "✓" : "✗"}</td>
        <td>${esc(m.name)}</td>
        <td class="num">${m.score.toFixed(3)}</td>
        <td class="num">${thr}</td>
        <td>${reason}${err}</td>
      </tr>`;
    })
    .join("\n");

  return `<article class="case ${scoreClass(tc.success)}">
    <header>
      <span class="badge">${mark}</span>
      <h3>${esc(tc.testCaseName ?? tc.inputPreview)}</h3>
      <p class="preview">${esc(tc.inputPreview)}</p>
    </header>
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Metric</th>
          <th>Score</th>
          <th>Threshold</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </article>`;
}

function renderSuite(suite: SuiteReport): string {
  const { report } = suite;
  return `<section class="suite">
    <div class="suite-head">
      <h2>${esc(suite.name)}</h2>
      <div class="pill">
        <span class="ok">${report.passCount} passed</span>
        <span class="bad">${report.failCount} failed</span>
        <span>of ${report.results.length}</span>
      </div>
    </div>
    ${report.results.map(renderCase).join("\n")}
  </section>`;
}

export function renderHtmlReport(suites: SuiteReport[], title = "DeepEVal Report"): string {
  const totalPass = suites.reduce((a, s) => a + s.report.passCount, 0);
  const totalFail = suites.reduce((a, s) => a + s.report.failCount, 0);
  const total = totalPass + totalFail;
  const generated = new Date().toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #1a2332;
      --border: #2d3a4f;
      --text: #e7ecf3;
      --muted: #9aa8bc;
      --pass: #3dd68c;
      --fail: #f07178;
      --accent: #5eb1ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: radial-gradient(1200px 600px at 10% -10%, #1c3a5f 0%, transparent 50%),
                  radial-gradient(900px 500px at 100% 0%, #1a3d32 0%, transparent 45%),
                  var(--bg);
      color: var(--text);
      line-height: 1.45;
      padding: 2rem 1.25rem 4rem;
    }
    .wrap { max-width: 980px; margin: 0 auto; }
    h1 { margin: 0 0 0.35rem; font-size: 1.75rem; letter-spacing: -0.02em; }
    .meta { color: var(--muted); margin-bottom: 1.5rem; }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      margin-bottom: 2rem;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.1rem;
    }
    .card .label { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .card .value { font-size: 1.8rem; font-weight: 700; margin-top: 0.25rem; }
    .card.pass .value { color: var(--pass); }
    .card.fail .value { color: var(--fail); }
    .suite { margin-bottom: 2rem; }
    .suite-head {
      display: flex; align-items: baseline; justify-content: space-between; gap: 1rem;
      margin-bottom: 0.85rem; flex-wrap: wrap;
    }
    .suite-head h2 { margin: 0; font-size: 1.25rem; }
    .pill {
      display: flex; gap: 0.75rem; color: var(--muted); font-size: 0.9rem;
      background: var(--panel); border: 1px solid var(--border);
      padding: 0.35rem 0.75rem; border-radius: 999px;
    }
    .pill .ok { color: var(--pass); }
    .pill .bad { color: var(--fail); }
    .case {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.1rem;
      margin-bottom: 0.75rem;
    }
    .case.fail { border-color: color-mix(in srgb, var(--fail) 45%, var(--border)); }
    .case.pass { border-color: color-mix(in srgb, var(--pass) 35%, var(--border)); }
    .case header { display: grid; gap: 0.2rem; margin-bottom: 0.75rem; }
    .badge {
      width: fit-content;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em;
      padding: 0.15rem 0.45rem; border-radius: 6px;
    }
    .case.pass .badge { background: color-mix(in srgb, var(--pass) 22%, transparent); color: var(--pass); }
    .case.fail .badge { background: color-mix(in srgb, var(--fail) 22%, transparent); color: var(--fail); }
    h3 { margin: 0; font-size: 1.05rem; }
    .preview { margin: 0; color: var(--muted); font-size: 0.88rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.45rem 0.35rem; border-top: 1px solid var(--border); vertical-align: top; }
    th { color: var(--muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    td.num { font-variant-numeric: tabular-nums; font-family: ui-monospace, Consolas, monospace; }
    tr.fail td:nth-child(3) { color: var(--fail); font-weight: 600; }
    tr.pass td:nth-child(3) { color: var(--pass); }
    .reason, .error { color: var(--muted); font-size: 0.82rem; }
    .error { color: var(--fail); }
    footer { margin-top: 2rem; color: var(--muted); font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${esc(title)}</h1>
    <p class="meta">Generated ${esc(generated)} · Judge: heuristic-system-one (offline)</p>
    <div class="summary">
      <div class="card"><div class="label">Total cases</div><div class="value">${total}</div></div>
      <div class="card pass"><div class="label">Passed</div><div class="value">${totalPass}</div></div>
      <div class="card fail"><div class="label">Failed</div><div class="value">${totalFail}</div></div>
    </div>
    ${suites.map(renderSuite).join("\n")}
    <footer>DeepEVal Framework — scores are 0–1; pass when score ≥ threshold.</footer>
  </div>
</body>
</html>`;
}

export function writeHtmlReport(
  filePath: string,
  suites: SuiteReport[],
  title?: string,
): string {
  mkdirSync(dirname(filePath), { recursive: true });
  const html = renderHtmlReport(suites, title);
  writeFileSync(filePath, html, "utf8");
  return filePath;
}
