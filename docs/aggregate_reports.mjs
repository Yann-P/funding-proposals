// Generate one MyST page per funded project by concatenating its reports newest-first.
//
// Each project's reports are listed in its project.yml as a glob or a list of
// filenames/globs (reports: "*-report.md", or reports: [2026-06-report.md, ...]).
// Each report carries its own date in its frontmatter (date: "2026-06", or
// "2026-06-03" when the day matters).
//
// Reads ../Reports/<cycle>/<project>/ and writes ./projects/<cycle>/<project>.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mystParse } from "myst-parser";
import { parse as parseYaml } from "yaml";

const DOCS = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.join(DOCS, "..", "Reports");
const OUT = path.join(DOCS, "projects");

const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

// Read project.yml (title, proposal_issue, status, reports), falling back to the folder name.
function projectConfig(project) {
  const config = path.join(project, "project.yml");
  const info = fs.existsSync(config) ? parseYaml(fs.readFileSync(config, "utf8")) : {};
  if (!info.title) {
    console.log(`!! no title in ${config}; using folder name`);
    info.title = path.basename(project).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return info;
}

// Pull the report's date out of its frontmatter: date: "2026-06" or "2026-06-03".
function reportDate(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;
  return text.slice(4, end).match(/^date:\s*["']?(\d{4})-(\d{2})(?:-(\d{2}))?["']?\s*$/m);
}

function stripFrontmatter(text) {
  if (text.startsWith("---\n")) {
    const end = text.indexOf("\n---\n", 4);
    if (end !== -1) return text.slice(end + 5).replace(/^\n+/, "");
  }
  return text;
}

// Shift headings down one level so report sections sit under the month heading.
function demoteHeadings(text) {
  const lines = text.split("\n");
  // We only need to find top-level headings (though we unwrap top-level +++ blocks as well).
  const top = mystParse(text).children.flatMap((n) => (n.type === "block" ? n.children : [n]));
  for (const node of top) {
    if (node.type === "heading" && node.depth < 6) {
      // Doubling the line's first "#" demotes an ATX heading. A setext
      // (underlined) heading has no "#", so it keeps its level.
      const start = node.position.start.line - 1;
      lines[start] = lines[start].replace("#", "##");
    }
  }
  return lines.join("\n");
}

fs.rmSync(OUT, { recursive: true, force: true });
const dirNames = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();

for (const cycle of dirNames(REPORTS)) {
  for (const projectName of dirNames(path.join(REPORTS, cycle))) {
    const project = path.join(REPORTS, cycle, projectName);
    const info = projectConfig(project);
    const files = new Set();
    for (const pattern of [info.reports ?? []].flat()) {
      const matches = fs.globSync(pattern, { cwd: project }).sort();
      if (!matches.length) console.log(`!! no report matches "${pattern}" in ${project}`);
      for (const f of matches) files.add(f);
    }
    const reports = [];
    for (const name of files) {
      const file = path.join(project, name);
      const text = fs.readFileSync(file, "utf8");
      const m = reportDate(text);
      if (!m) {
        console.log(`!! no date in the frontmatter of ${file}`);
        continue;
      }
      reports.push({ year: m[1], month: m[2], day: m[3], text });
    }
    // Catch report files that were added to the folder but never listed/matched.
    for (const md of fs.readdirSync(project).filter((f) => f.endsWith(".md") && !files.has(f))) {
      console.log(`!! ${path.join(project, md)} is not matched by reports in project.yml`);
    }
    if (!reports.length) continue;
    reports.sort((a, b) =>
      `${b.year}-${b.month}-${b.day ?? ""}`.localeCompare(`${a.year}-${a.month}-${a.day ?? ""}`));
    const sections = reports.map((r) => {
      const body = demoteHeadings(stripFrontmatter(r.text));
      return `## ${MONTHS[Number(r.month) - 1]} ${r.year}\n\n${body.trim()}\n`;
    });
    // Only claim the precision the report's date gives: "July 2, 2026" or
    // "June 2026". The ISO "latest report date" field exists solely for
    // the index listing's :sort:; it is never displayed.
    const { year, month, day } = reports[0];
    const monthName = MONTHS[Number(month) - 1];
    const latest = day ? `${monthName} ${Number(day)}, ${year}` : `${monthName} ${year}`;
    const latestIso = day ? `${year}-${month}-${day}` : `${year}-${month}`;
    // Frontmatter field names double as the index listing's column headers.
    const round = info.funding_round ?? "";
    if (!round) console.log(`!! no funding_round in ${path.join(project, "project.yml")}`);
    const frontmatter = [
      `title: "${info.title}"`,
      `funding round: "${round}"`,
      `latest report: "${latest}"`,
      `latest report date: "${latestIso}"`,
    ];
    const intro = [];
    if (info.status) {
      frontmatter.push(`status: "${info.status}"`);
      intro.push(`**Status:** ${info.status}`);
    }
    if (info.proposal_issue) intro.push(`[Proposal](${info.proposal_issue})`);
    let header = `---\n${frontmatter.join("\n")}\n---\n\n`;
    if (intro.length) header += `${intro.join(" · ")}\n\n`;
    const page = path.join(OUT, cycle, `${projectName}.md`);
    fs.mkdirSync(path.dirname(page), { recursive: true });
    fs.writeFileSync(page, header + sections.join("\n"));
    console.log(`wrote ${path.relative(DOCS, page)} (${reports.length} reports)`);
  }
}
