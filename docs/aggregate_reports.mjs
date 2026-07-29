// Generate one MyST page per funded project by concatenating its reports in date order.
//
// Reads ../Reports/<cycle>/<project>/*.md and writes ./projects/<cycle>/<project>.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mystParse } from "myst-parser";
import { parse as parseToml } from "smol-toml";

const DOCS = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.join(DOCS, "..", "Reports");
const OUT = path.join(DOCS, "projects");

const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

// Read project.toml (title, proposal, status), falling back to the folder name.
function projectConfig(project) {
  const config = path.join(project, "project.toml");
  const info = fs.existsSync(config) ? parseToml(fs.readFileSync(config, "utf8")) : {};
  if (!info.title) {
    console.log(`!! no title in ${config}; using folder name`);
    info.title = path.basename(project).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return info;
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
    const reports = [];
    for (const md of fs.readdirSync(project).filter((f) => f.endsWith(".md"))) {
      const m = md.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
      if (!m) {
        console.log(`!! skipping unrecognized filename: ${path.join(project, md)}`);
        continue;
      }
      reports.push({ year: m[1], month: m[2], day: m[3], path: path.join(project, md) });
    }
    if (!reports.length) continue;
    reports.sort((a, b) =>
      `${a.year}-${a.month}-${a.day ?? ""}`.localeCompare(`${b.year}-${b.month}-${b.day ?? ""}`));
    const sections = reports.map((r) => {
      const body = demoteHeadings(stripFrontmatter(fs.readFileSync(r.path, "utf8")));
      return `## ${MONTHS[Number(r.month) - 1]} ${r.year}\n\n${body.trim()}\n`;
    });
    // Only claim the precision the filename gives: "July 2, 2026" or
    // "June 2026". The ISO "latest report date" field exists solely for
    // the index listing's :sort:; it is never displayed.
    const { year, month, day } = reports[reports.length - 1];
    const monthName = MONTHS[Number(month) - 1];
    const latest = day ? `${monthName} ${Number(day)}, ${year}` : `${monthName} ${year}`;
    const latestIso = day ? `${year}-${month}-${day}` : `${year}-${month}`;
    // Frontmatter field names double as the index listing's column headers.
    const round = info.funding_round ?? "";
    if (!round) console.log(`!! no funding_round in ${path.join(project, "project.toml")}`);
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
    if (info.proposal) intro.push(`[Proposal](${info.proposal})`);
    let header = `---\n${frontmatter.join("\n")}\n---\n\n`;
    if (intro.length) header += `${intro.join(" · ")}\n\n`;
    const page = path.join(OUT, cycle, `${projectName}.md`);
    fs.mkdirSync(path.dirname(page), { recursive: true });
    fs.writeFileSync(page, header + sections.join("\n"));
    console.log(`wrote ${path.relative(DOCS, page)} (${reports.length} reports)`);
  }
}
