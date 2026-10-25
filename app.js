const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  shield: '<path d="M12 3 19 6v5c0 4.4-2.8 8-7 10-4.2-2-7-5.6-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="M20 11.2V12a8 8 0 1 1-4.7-7.3"/><path d="m8.8 11.8 3.1 3.1L21 5.8"/>',
  chart: '<path d="M4 19V5"/><path d="M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/>',
  scope: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.5 1.5c-1.2 1.4-2.1 1.6-2.1 3.1"/><path d="M12 17.5h.01"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.5 4.5"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};

const icon = (name, size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const formatPercent = value => `${Math.round(value * 100)}%`;

const state = {
  view: "overview",
  findings: [],
  benchmark: [],
  filter: "all",
  search: "",
  selectedFinding: null,
  approvalState: "awaiting",
  scopeSaved: false,
  selectedRepos: ["orchard-api", "atlas-web"],
  benchmarkHasRun: false,
  toastTimer: null
};

const content = document.querySelector("#app-content");
const sectionLabel = document.querySelector("#current-section");

document.querySelectorAll("[data-icon]").forEach(element => {
  element.innerHTML = icon(element.dataset.icon);
});

function severityClass(severity) {
  return ["critical", "high", "medium", "low"].includes(severity) ? severity : "low";
}

function findingEvidence(finding) {
  return finding.evidence && finding.evidence.length ? finding.evidence[0] : null;
}

function findingPath(finding) {
  const evidence = findingEvidence(finding);
  return evidence ? evidence.path : "—";
}

function scopedFindings() {
  return state.findings.filter(finding => state.selectedRepos.includes(finding.repository));
}

function heading(eyebrow, title, description, actions = "") {
  return `<div class="page-heading">
    <div class="heading-copy">
      <div class="eyebrow"><span class="eyebrow-mark"></span>${escapeHTML(eyebrow)}</div>
      <h1>${escapeHTML(title)}</h1>
      <p>${escapeHTML(description)}</p>
    </div>
    ${actions ? `<div class="heading-actions">${actions}</div>` : ""}
  </div>`;
}

function fixtureNotice(copy = "Every repository, finding, excerpt, approval, and score here is synthetic fixture data. Nectar is not connected to a real code host.") {
  return `<div class="preview-note"><span class="note-icon" aria-hidden="true">i</span><span><strong>Preview only.</strong> ${escapeHTML(copy)}</span></div>`;
}

function statCard(label, value, context, iconName, emphasis = "") {
  return `<article class="stat-card">
    <div class="stat-top"><span>${escapeHTML(label)}</span><span class="stat-icon">${icon(iconName, 14)}</span></div>
    <div class="stat-value-row"><strong class="stat-value">${escapeHTML(value)}</strong><span class="stat-change">${escapeHTML(emphasis)}</span></div>
    <div class="stat-description">${escapeHTML(context)}</div>
  </article>`;
}

function findingRow(finding, compact = false) {
  const evidence = findingEvidence(finding);
  const severity = severityClass(finding.severity);
  const status = finding.finding_id === "SEC-1042" ? "Needs review" : "Evidence ready";
  if (compact) {
    return `<button class="queue-item" type="button" data-open-finding="${escapeHTML(finding.finding_id)}">
      <span class="severity-dot ${severity}"></span>
      <span class="queue-content"><strong>${escapeHTML(finding.title)}</strong><span class="queue-meta"><span>${escapeHTML(finding.finding_id)}</span><span>·</span><span>${escapeHTML(finding.repository)}</span></span></span>
      <span class="queue-arrow" aria-hidden="true">›</span>
    </button>`;
  }
  return `<button class="finding-row" type="button" data-open-finding="${escapeHTML(finding.finding_id)}" aria-label="Open ${escapeHTML(finding.finding_id)}: ${escapeHTML(finding.title)}">
    <span class="finding-title-cell"><span class="severity-dot ${severity}"></span><span><strong>${escapeHTML(finding.title)}</strong><small>${escapeHTML(finding.severity.toUpperCase())} · ${escapeHTML(finding.finding_id)} · ${escapeHTML(finding.rule_id)}</small></span></span>
    <span class="repo-cell">${escapeHTML(finding.repository)}</span>
    <span class="path-cell">${escapeHTML(evidence ? evidence.path + ":" + evidence.line_start : "—")}</span>
    <span class="confidence-cell">${formatPercent(finding.confidence)}</span>
    <span class="state-label">${escapeHTML(status)}</span>
  </button>`;
}

function renderOverview() {
  const visibleFindings = scopedFindings();
  const priority = visibleFindings.find(finding => finding.finding_id === "SEC-1042");
  const latest = visibleFindings.filter(finding => finding.finding_id !== "SEC-1042").slice(0, 2);
  const chart = state.benchmark.slice(0, 6).map((item, index) => {
    const expected = item.expected_rule_ids.length;
    const observed = item.observed_rule_ids.length;
    const expectedHeight = expected ? 72 : 4;
    const observedHeight = observed ? 54 : 4;
    return `<div class="bar-group"><div class="bar-pair"><span class="bar secondary" style="height:${observedHeight}%"></span><span class="bar" style="height:${expectedHeight}%"></span></div><span class="bar-label">${String(index + 1).padStart(2, "0")}</span></div>`;
  }).join("");
  const needsReview = state.approvalState === "approved" || !state.selectedRepos.includes("orchard-api") ? "00" : "01";
  content.innerHTML = `
    ${heading("Workspace overview", "Security overview", "Evidence first. Human approval before change.", '<button class="button button-primary" type="button" data-view="setup">' + icon("scope", 14) + ' Configure scope</button>')}
    ${fixtureNotice()}
    <section class="stat-grid" aria-label="Synthetic workspace metrics">
      ${statCard("Open findings", String(visibleFindings.length).padStart(2, "0"), `Across ${state.selectedRepos.length} selected fixture repositories`, "shield", "synthetic")}
      ${statCard("Needs review", needsReview, "Proposal stops at human approval", "check", "local demo")}
      ${statCard("Scope coverage", `${state.selectedRepos.length} / 2`, "Selected fixture repositories", "scope", "fixture set")}
      ${statCard("Regression cases", String(state.benchmark.length).padStart(2, "0"), "Committed deterministic fixtures", "chart", "offline")}
    </section>
    <div class="dashboard-grid">
      <div class="content-stack">
        <section class="panel" aria-labelledby="replay-title">
          <div class="panel-header"><div><h2 id="replay-title">Fixture replay activity</h2><p>Expected and observed rule labels from six committed cases</p></div><span class="chart-legend"><span class="legend-dot"></span>Expected<span class="legend-dot observed"></span>Observed</span></div>
          <div class="chart-wrap"><div class="bar-chart" role="img" aria-label="Expected and observed rule presence in six deterministic synthetic benchmark cases">${chart}</div><div class="chart-foot"><span><strong>Deterministic replay</strong> · synthetic inputs only</span><button class="panel-link" type="button" data-view="evaluations">View evaluation details →</button></div></div>
        </section>
        <section class="panel">
          <div class="panel-header"><div><h2>Prioritized findings</h2><p>${visibleFindings.length} synthetic examples in the selected scope</p></div><button class="panel-link" type="button" data-view="findings">View all →</button></div>
          <div class="queue-list">
            ${priority ? findingRow(priority, true) : '<div class="empty-state">No pending proposal in the selected fixture scope.</div>'}
            ${latest.map(finding => findingRow(finding, true)).join("")}
          </div>
        </section>
      </div>
      <div class="content-stack">
        <section class="panel">
          <div class="panel-header"><div><h2>Selected scope</h2><p>Local fixture inputs only</p></div><button class="panel-link" type="button" data-view="setup">Edit scope</button></div>
          <div class="scope-mini">
            ${state.selectedRepos.length ? state.selectedRepos.map((repo, index) => `<div class="scope-line"><span class="repo-logo">${repo === "orchard-api" ? "O" : "A"}</span><span><strong>${escapeHTML(repo)}</strong><small>Fixture snapshot · read-only</small></span><span class="scope-ready">Selected</span></div>`).join("") : '<div class="empty-state">No fixtures selected.</div>'}
          </div>
        </section>
        <section class="panel">
          <div class="panel-header"><div><h2>Safety boundary</h2><p>Explicit and visible by default</p></div></div>
          <div class="policy-summary">
            <div class="policy-row"><span class="policy-check">✓</span><span>Repository content stays in read-only review.</span></div>
            <div class="policy-row"><span class="policy-lock">⌑</span><span>Any proposed write requires explicit human approval.</span></div>
            <div class="policy-row"><span class="policy-lock">—</span><span>No active scanning or external connection.</span></div>
          </div>
        </section>
      </div>
    </div>`;
}

function filteredFindings() {
  return scopedFindings().filter(finding => {
    const severityMatches = state.filter === "all" || finding.severity === state.filter;
    const query = state.search.trim().toLowerCase();
    const searchMatches = !query || [finding.title, finding.finding_id, finding.rule_id, finding.repository, findingPath(finding)].join(" ").toLowerCase().includes(query);
    return severityMatches && searchMatches;
  });
}

function renderFindingList() {
  const rows = filteredFindings();
  const list = document.querySelector("#finding-list");
  if (!list) return;
  list.innerHTML = rows.length ? rows.map(finding => findingRow(finding)).join("") : '<div class="empty-state">No fixture findings match this filter.</div>';
}

function renderFindings() {
  const filters = ["all", "critical", "high", "medium", "low"];
  const visibleCount = scopedFindings().length;
  content.innerHTML = `
    ${heading("Evidence-backed queue", "Findings", "Prioritized signals with source-level provenance and confidence.", `<span class="fixture-pill">${String(visibleCount).padStart(2, "0")} in selected scope</span>`)}
    ${fixtureNotice("This queue is loaded from committed examples only; no repository has been scanned.")}
    <div class="finding-toolbar">
      <div class="filter-row" role="group" aria-label="Filter findings by severity">
        ${filters.map(filter => `<button class="filter-chip ${state.filter === filter ? "selected" : ""}" type="button" data-filter="${filter}" aria-pressed="${state.filter === filter}">${filter === "all" ? "All findings" : filter[0].toUpperCase() + filter.slice(1)}</button>`).join("")}
      </div>
      <label class="search-field"><span class="visually-hidden">Search synthetic findings</span>${icon("search", 13)}<input type="search" id="finding-search" placeholder="Search ID, repo, or path" value="${escapeHTML(state.search)}"></label>
    </div>
    <section class="finding-table-card" aria-label="Synthetic findings">
      <div class="finding-table-head"><span>Finding</span><span>Repository</span><span>Evidence location</span><span>Confidence</span><span>State</span></div>
      <div id="finding-list"></div>
    </section>
    <div class="chart-foot"><span><strong>Provenance attached</strong> to every fixture finding</span><span>Confidence is a fixture attribute, not a calibrated production score.</span></div>`;
  renderFindingList();
}

function renderFindingDetail() {
  const finding = state.findings.find(item => item.finding_id === state.selectedFinding) || scopedFindings()[0];
  if (!finding || !state.selectedRepos.includes(finding.repository)) {
    state.view = "findings";
    render();
    return;
  }
  state.selectedFinding = finding.finding_id;
  const evidence = findingEvidence(finding);
  const confidence = Math.round(finding.confidence * 100);
  const approved = state.approvalState === "approved" && finding.finding_id === "SEC-1042";
  const statusText = approved ? "Approved · simulated" : "Awaiting human review";
  const line = evidence ? evidence.line_start : 1;
  const excerpt = evidence ? evidence.excerpt : "";
  const token = evidence ? evidence.excerpt_sha256 : "";
  const fixBlock = finding.finding_id === "SEC-1042"
    ? '<span class="diff-line minus">- subprocess.run(f"grep {query} ./content", shell=True)</span><span class="diff-line plus">+ subprocess.run(["grep", "--", query, "./content"], shell=False)</span>'
    : '<span class="diff-line minus">- ' + escapeHTML(excerpt) + '</span><span class="diff-line plus">+ Apply a reviewed, rule-specific remediation</span>';
  content.innerHTML = `
    <button class="detail-back" type="button" data-view="findings">← All findings</button>
    <div class="detail-layout">
      <div class="detail-main">
        <section class="panel detail-title-card">
          <div class="detail-meta"><span class="severity-label"><span class="severity-dot ${severityClass(finding.severity)}"></span>${escapeHTML(finding.severity)}</span><span class="detail-id">${escapeHTML(finding.finding_id)} · ${escapeHTML(finding.rule_id)}</span><span class="fixture-pill">Synthetic fixture</span></div>
          <h1>${escapeHTML(finding.title)}</h1>
          <p>${escapeHTML(finding.description)}</p>
          <div class="detail-location"><span>Repository</span><code>${escapeHTML(finding.repository)}</code><span class="location-separator">/</span><code>${escapeHTML(evidence ? evidence.path : "—")}:${line}</code><span class="location-separator">·</span><span>Fixture ref</span><code>${escapeHTML(evidence ? evidence.source_ref.split(" · ")[0] : "—")}</code></div>
        </section>
        <section class="panel evidence-card">
          <div class="evidence-head"><div><h2>Evidence provenance</h2><p>The source excerpt, rule reference, and integrity digest are visible together.</p></div><span class="source-chip">Fixture evidence</span></div>
          <div class="code-evidence"><div class="code-file"><span>${escapeHTML(evidence ? evidence.path : "—")}</span><span>line ${line}</span></div><div class="code-line"><span class="code-line-number">${line}</span><span>${escapeHTML(excerpt)}</span></div></div>
          <div class="evidence-provenance">
            <div class="provenance-item"><span>Source</span><strong>${escapeHTML(evidence ? evidence.source : "—")}</strong></div>
            <div class="provenance-item"><span>Rule / fixture ref</span><strong>${escapeHTML(evidence ? evidence.source_ref : "—")}</strong></div>
            <div class="provenance-item"><span>Excerpt SHA-256</span><strong title="${escapeHTML(token)}">${escapeHTML(token)}</strong></div>
          </div>
        </section>
      </div>
      <aside class="detail-side" aria-label="Finding review and proposal">
        <section class="panel detail-panel">
          <h2>Confidence &amp; recommendation</h2>
          <div class="confidence-visual"><div class="confidence-ring" data-value="${confidence}%" style="--confidence:${confidence}%"></div><div class="confidence-copy"><strong>${confidence}% fixture confidence</strong><small>Rule-level confidence for this example. Not a probability calibration.</small></div></div>
          <ul class="recommendation-list"><li>${escapeHTML(finding.recommendation)}</li><li>Validate behavior with a regression test before any change is applied.</li></ul>
        </section>
        <section class="panel proposal-card">
          <div class="proposal-topline"><h2>Safe fix proposal</h2><span class="review-status ${approved ? "approved" : ""}">${statusText}</span></div>
          <p>A reviewable suggestion only. No file has been changed and no patch is executable in this prototype.</p>
          <div class="diff-block" aria-label="Illustrative fix proposal">${fixBlock}</div>
          <div class="approval-boundary"><span class="boundary-icon" aria-hidden="true">⌑</span><span><strong>Human review required.</strong> Approval records a local simulation only; it does not authorize an actual repository write.</span></div>
          <button class="button ${approved ? "" : "button-primary"}" type="button" data-view="approvals">Review proposal ${icon("arrow", 13)}</button>
          <p class="proposal-footnote">No Git integration · no write capability connected</p>
        </section>
      </aside>
    </div>`;
}

function renderApprovals() {
  const finding = state.findings.find(item => item.finding_id === "SEC-1042");
  const inScope = state.selectedRepos.includes("orchard-api");
  const approved = state.approvalState === "approved" && inScope;
  content.innerHTML = `
    ${heading("Human action boundary", "Review queue", "Review a proposed change before any write-capable system could act.", '<span class="fixture-pill">Local simulation</span>')}
    ${fixtureNotice("The queue is a product-flow mock. Nothing is sent to a repository, identity provider, or external service.")}
    <div class="section-heading"><div><h2>${approved ? "Completed in this simulation" : "Waiting for human review"}</h2><p>One fixture proposal · no files or branches have changed</p></div><span class="state-label">${approved ? "Approved · simulated" : "1 awaiting"}</span></div>
    ${approved ? `<section class="panel approval-empty"><strong>Approval recorded locally</strong><p>This state is not a signed approval, does not persist to a server, and cannot write to a repository.</p><button class="button" style="margin-top:14px" type="button" data-action="reset-approval">Reset demo state</button></section>` : !inScope ? `<section class="panel approval-empty"><strong>Outside the selected fixture scope</strong><p>Select orchard-api in Scope &amp; access to view its mock proposal.</p><button class="button" style="margin-top:14px" type="button" data-view="setup">Adjust preview scope</button></section>` : `
      <section class="approval-list">
        <article class="panel approval-item">
          <div class="approval-item-main">
            <div class="approval-item-top"><span class="severity-label"><span class="severity-dot critical"></span>Critical</span><span class="detail-id">${finding ? escapeHTML(finding.finding_id) : "SEC-1042"}</span><span class="fixture-pill">Synthetic fixture</span></div>
            <h3>${finding ? escapeHTML(finding.title) : "Untrusted search text reaches a shell command"}</h3>
            <p>Proposed argument-vector change removes shell parsing. Regression expectation: request text remains an argument, not shell syntax. Validate the exact diff and test before any future apply capability.</p>
            <div class="approval-item-meta"><span>Repository: orchard-api (fixture)</span><span>src/search.py:88</span><span>Evidence digest verified</span></div>
          </div>
          <div class="approval-item-side">
            <span class="review-status">Awaiting human review</span>
            <button class="button button-primary" type="button" data-action="simulate-approve">Approve in simulation</button>
            <small>This changes only this browser's prototype state. It does not approve or apply a real patch.</small>
          </div>
        </article>
      </section>`}
    <div class="panel safety-callout"><strong>Capability gate:</strong> exact repository scope → explicit operation approval → reviewable diff → regression evidence. The prototype ends before any write or merge.</div>`;
}

function evaluateBenchmark() {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  state.benchmark.forEach(item => {
    const expected = new Set(item.expected_rule_ids);
    const observed = new Set(item.observed_rule_ids);
    expected.forEach(rule => observed.has(rule) ? tp++ : fn++);
    observed.forEach(rule => expected.has(rule) ? null : fp++);
  });
  return { tp, fp, fn, precision: tp / (tp + fp || 1), recall: tp / (tp + fn || 1) };
}

function renderEvaluations() {
  const result = evaluateBenchmark();
  const rows = state.benchmark.map(item => {
    const expected = new Set(item.expected_rule_ids);
    const observed = new Set(item.observed_rule_ids);
    const fp = [...observed].filter(rule => !expected.has(rule)).length;
    const fn = [...expected].filter(rule => !observed.has(rule)).length;
    const outcome = fp ? ["false-positive", "×", "False positive"] : fn ? ["miss", "–", "Missed rule"] : ["", "✓", "Matched"];
    return `<tr><td>${escapeHTML(item.label)}</td><td class="benchmark-code">${escapeHTML(item.case_id)}</td><td>${escapeHTML(item.expected_rule_ids.join(", ") || "—")}</td><td>${escapeHTML(item.observed_rule_ids.join(", ") || "—")}</td><td><span class="outcome ${outcome[0]}"><span class="outcome-symbol">${outcome[1]}</span>${outcome[2]}</span></td></tr>`;
  }).join("");
  content.innerHTML = `
    ${heading("Quality & regression", "Evaluations", "A small, transparent fixture benchmark—not a claim of production detection quality.", '<button class="button button-primary" type="button" data-action="run-benchmark">' + icon("chart", 14) + ' Run fixture replay</button>')}
    ${fixtureNotice("Scores are computed from six committed expected/observed labels. Replay is deterministic and offline.")}
    <section class="eval-summary">
      <div class="eval-intro"><h2>Fixture replay benchmark</h2><p>Every case is versioned and inspectable. Use the suite to prove deterministic calculations and regression plumbing—not to infer real-world coverage.</p></div>
      <div class="eval-metric"><span>Precision</span><strong>${formatPercent(result.precision)}</strong><small>${result.tp} correct / ${result.tp + result.fp} observed</small></div>
      <div class="eval-metric"><span>Recall</span><strong>${formatPercent(result.recall)}</strong><small>${result.tp} found / ${result.tp + result.fn} expected</small></div>
      <div class="eval-metric"><span>Fixture cases</span><strong>${state.benchmark.length}</strong><small>Committed · synthetic</small></div>
    </section>
    <section class="evaluation-card" aria-label="Fixture benchmark cases">
      <table class="benchmark-table"><thead><tr><th>Case</th><th>Fixture ID</th><th>Expected</th><th>Observed</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="evaluation-foot"><span>${state.benchmarkHasRun ? "Replay completed locally. No code was scanned." : "Displayed from the committed deterministic fixture."}</span><span>TP ${result.tp} · FP ${result.fp} · FN ${result.fn}</span></div>
    </section>`;
}

function loadSavedScope() {
  try {
    const stored = JSON.parse(localStorage.getItem("nectar.preview.scope") || "null");
    if (Array.isArray(stored) && stored.every(name => ["orchard-api", "atlas-web"].includes(name))) {
      state.selectedRepos = stored;
      state.scopeSaved = true;
    }
  } catch (_) {
    state.scopeSaved = false;
  }
}

function renderSetup() {
  const repositories = [
    { name: "orchard-api", description: "Python service · fixture snapshot fixture-4d92b1a", letter: "O", count: "2 fixture findings" },
    { name: "atlas-web", description: "Web application · fixture snapshot fixture-7a13c02", letter: "A", count: "2 fixture findings" }
  ];
  content.innerHTML = `
    ${heading("First-run setup", "Scope & access", "Choose local fixture inputs and review the capability boundary.", '<span class="fixture-pill">No provider connected</span>')}
    ${fixtureNotice("This setup selects examples bundled in the repository. It cannot connect to or authorize access to a real code host.")}
    <div class="setup-progress" aria-label="Setup steps">
      <div class="setup-step active"><span class="step-number">1</span><span>Select scope</span></div>
      <div class="setup-step active"><span class="step-number">2</span><span>Set boundaries</span></div>
      <div class="setup-step"><span class="step-number">3</span><span>Review &amp; save</span></div>
    </div>
    <div class="setup-columns">
      <section class="setup-card">
        <div class="setup-card-header"><div><h2>Choose repository fixtures</h2><p>Only these synthetic snapshots appear in the overview and finding list.</p></div><span class="synthetic-tag">FIXTURE DATA</span></div>
        <div class="repo-select-list">
          ${repositories.map(repo => `<label class="repo-select ${state.selectedRepos.includes(repo.name) ? "selected" : ""}"><input type="checkbox" data-repo-select="${repo.name}" ${state.selectedRepos.includes(repo.name) ? "checked" : ""}><span class="repo-logo">${repo.letter}</span><span class="repo-select-copy"><strong>${repo.name}</strong><small>${repo.description}</small></span><span class="repo-select-status">${repo.count}</span></label>`).join("")}
        </div>
        <div class="setup-footer"><small>Fixture snapshots are examples only. No source is uploaded, cloned, fetched, or scanned.</small><button class="button button-primary" type="button" data-action="save-scope" ${state.selectedRepos.length ? "" : "disabled"}>Save preview scope ${icon("arrow", 13)}</button></div>
        <div class="saved-message" id="scope-saved-message" role="status">${state.scopeSaved ? "Preview scope saved in this browser." : ""}</div>
      </section>
      <section class="setup-card">
        <div class="setup-card-header"><div><h2>Capability boundaries</h2><p>Default-deny policy with an explicit human checkpoint.</p></div></div>
        <div class="setup-policy-list">
          <div class="setup-policy"><span class="policy-icon">✓</span><span class="setup-policy-copy"><strong>Read-only evidence review</strong><small>Findings expose source references; they do not enable a repository write.</small></span><button class="policy-toggle on" type="button" aria-label="Read-only review enabled" aria-pressed="true" disabled><span></span></button></div>
          <div class="setup-policy"><span class="policy-icon locked">⌑</span><span class="setup-policy-copy"><strong>Human approval for every write</strong><small>A matching, explicit approval is required by the deterministic policy gate.</small></span><button class="policy-toggle on" type="button" aria-label="Approval required" aria-pressed="true" disabled><span></span></button></div>
          <div class="setup-policy"><span class="policy-icon locked">—</span><span class="setup-policy-copy"><strong>Scanning and execution disabled</strong><small>No active scans, shell tools, exploit payloads, or auto-merge.</small></span><button class="policy-toggle" type="button" aria-label="Scanning disabled" aria-pressed="false" disabled><span></span></button></div>
          <div class="setup-policy"><span class="policy-icon locked">—</span><span class="setup-policy-copy"><strong>External providers disconnected</strong><small>No code host, alert source, model provider, or production account integration.</small></span><button class="policy-toggle" type="button" aria-label="Provider integrations disabled" aria-pressed="false" disabled><span></span></button></div>
        </div>
      </section>
    </div>`;
}

function updateNavigation() {
  document.querySelectorAll(".nav-link").forEach(button => {
    const active = button.dataset.view === state.view || (state.view === "detail" && button.dataset.view === "findings");
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const findingCount = document.querySelector('.nav-link[data-view="findings"] .nav-count');
  if (findingCount) findingCount.textContent = String(scopedFindings().length).padStart(2, "0");
  const approvalCount = document.querySelector('.nav-link[data-view="approvals"] .nav-count');
  if (approvalCount) approvalCount.textContent = state.approvalState === "approved" || !state.selectedRepos.includes("orchard-api") ? "00" : "01";
  const names = { overview: "Overview", findings: "Findings", detail: "Finding detail", approvals: "Review queue", evaluations: "Evaluations", setup: "Scope & access" };
  sectionLabel.textContent = names[state.view] || "Overview";
  document.title = `Nectar Security — ${names[state.view] || "Overview"}`;
}

function render() {
  document.body.classList.remove("menu-open");
  const mobileToggle = document.querySelector(".mobile-nav-toggle");
  if (mobileToggle) mobileToggle.setAttribute("aria-expanded", "false");
  content.setAttribute("aria-busy", "false");
  updateNavigation();
  if (state.view === "overview") renderOverview();
  else if (state.view === "findings") renderFindings();
  else if (state.view === "detail") renderFindingDetail();
  else if (state.view === "approvals") renderApprovals();
  else if (state.view === "evaluations") renderEvaluations();
  else if (state.view === "setup") renderSetup();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("visible"), 3800);
}

function openFinding(id) {
  state.selectedFinding = id;
  state.view = "detail";
  render();
}

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    event.preventDefault();
    state.view = viewButton.dataset.view;
    render();
    return;
  }
  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    state.filter = filterButton.dataset.filter;
    renderFindings();
    return;
  }
  const findingButton = event.target.closest("[data-open-finding]");
  if (findingButton) {
    openFinding(findingButton.dataset.openFinding);
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "simulate-approve") {
      state.approvalState = "approved";
      render();
      showToast("Local simulation approved. No signed approval or repository write exists.");
    } else if (action === "reset-approval") {
      state.approvalState = "awaiting";
      render();
      showToast("Demo review state reset.");
    } else if (action === "save-scope") {
      if (!state.selectedRepos.length) return;
      try {
        localStorage.setItem("nectar.preview.scope", JSON.stringify(state.selectedRepos));
        state.scopeSaved = true;
        renderSetup();
        showToast("Preview scope saved in this browser only.");
      } catch (_) {
        showToast("Browser storage is unavailable; scope was not saved.");
      }
    } else if (action === "run-benchmark") {
      state.benchmarkHasRun = true;
      render();
      showToast("Six committed cases replayed locally; no repository was scanned.");
    }
    return;
  }
});

document.addEventListener("input", event => {
  if (event.target.id === "finding-search") {
    state.search = event.target.value;
    renderFindingList();
  }
});

document.addEventListener("change", event => {
  const checkbox = event.target.closest("[data-repo-select]");
  if (!checkbox) return;
  const name = checkbox.dataset.repoSelect;
  state.selectedRepos = checkbox.checked
    ? [...new Set([...state.selectedRepos, name])]
    : state.selectedRepos.filter(repo => repo !== name);
  state.scopeSaved = false;
  renderSetup();
  document.querySelector(`[data-repo-select="${name}"]`)?.focus();
});

document.querySelector(".mobile-nav-toggle").addEventListener("click", event => {
  const open = !document.body.classList.contains("menu-open");
  document.body.classList.toggle("menu-open", open);
  event.currentTarget.setAttribute("aria-expanded", String(open));
});
document.querySelector(".mobile-scrim").addEventListener("click", () => document.body.classList.remove("menu-open"));

async function init() {
  loadSavedScope();
  try {
    const [findingResponse, benchmarkResponse] = await Promise.all([
      fetch("./fixtures/findings.json"),
      fetch("./fixtures/benchmark.json")
    ]);
    if (!findingResponse.ok || !benchmarkResponse.ok) throw new Error("fixture load failed");
    const findingData = await findingResponse.json();
    const benchmarkData = await benchmarkResponse.json();
    if (findingData.synthetic !== true || benchmarkData.synthetic !== true) throw new Error("fixtures must be labeled synthetic");
    state.findings = findingData.findings;
    state.benchmark = benchmarkData.cases;
    render();
  } catch (_) {
    content.setAttribute("aria-busy", "false");
    content.innerHTML = '<section class="panel error-panel"><h1>Local fixtures unavailable</h1><p>Serve this repository over HTTP so the committed synthetic JSON files can be loaded.</p></section>';
  }
}

init();
