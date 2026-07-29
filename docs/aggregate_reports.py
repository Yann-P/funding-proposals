"""Generate one MyST page per funded project by concatenating its reports in date order.

Reads Reports/<cycle>/<project>/*.md and writes docs/projects/<cycle>/<project>.md.
Run from anywhere: paths are resolved relative to this file.
"""

import re
import shutil
import tomllib
from pathlib import Path

DOCS = Path(__file__).resolve().parent
REPORTS = DOCS.parent / "Reports"
OUT = DOCS / "projects"

MONTHS = ["January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"]


def project_config(project):
    """Read project.toml (title, proposal, status), falling back to the folder name."""
    config = project / "project.toml"
    info = tomllib.loads(config.read_text()) if config.is_file() else {}
    if not info.get("title"):
        print(f"!! no title in {config}; using folder name")
        info["title"] = project.name.replace("_", " ").title()
    return info


def strip_frontmatter(text):
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            return text[end + 5:].lstrip("\n")
    return text


def demote_headings(text):
    """Shift headings down one level so report sections sit under the month heading.

    Skips fenced code blocks so e.g. shell comments aren't rewritten.
    """
    lines = text.splitlines(keepends=True)
    fence = None
    for i, line in enumerate(lines):
        stripped = line.lstrip()
        if fence:
            if stripped.startswith(fence):
                fence = None
        elif stripped.startswith(("```", "~~~")):
            fence = stripped[:3]
        else:
            lines[i] = re.sub(r"^(#{1,5}) ", r"#\1 ", line)
    return "".join(lines)


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    for cycle in sorted(REPORTS.iterdir()):
        if not cycle.is_dir():
            continue
        for project in sorted(cycle.iterdir()):
            if not project.is_dir():
                continue
            info = project_config(project)
            name = info["title"]
            reports = []
            for md in project.glob("*.md"):
                m = re.match(r"(\d{4})-(\d{2})(?:-(\d{2}))?", md.name)
                if not m:
                    print(f"!! skipping unrecognized filename: {md}")
                    continue
                reports.append(((m.group(1), m.group(2), m.group(3)), md))
            if not reports:
                continue
            reports.sort(key=lambda r: (r[0][0], r[0][1], r[0][2] or ""))
            sections = []
            for (year, month, _), md in reports:
                body = demote_headings(strip_frontmatter(md.read_text()))
                sections.append(f"## {MONTHS[int(month) - 1]} {year}\n\n{body.strip()}\n")
            # Only claim the precision the filename gives: "July 2, 2026" or
            # "June 2026". The ISO "latest report date" field exists solely for
            # the index listing's :sort:; it is never displayed.
            year, month, day = reports[-1][0]
            month_name = MONTHS[int(month) - 1]
            latest = f"{month_name} {int(day)}, {year}" if day else f"{month_name} {year}"
            latest_iso = f"{year}-{month}-{day}" if day else f"{year}-{month}"
            # Frontmatter field names double as the index listing's column
            # headers.
            round_ = info.get("funding_round", "")
            if not round_:
                print(f"!! no funding_round in {project / 'project.toml'}")
            frontmatter = [
                f'title: "{name}"',
                f'funding round: "{round_}"',
                f'latest report: "{latest}"',
                f'latest report date: "{latest_iso}"',
            ]
            intro = []
            if info.get("status"):
                frontmatter.append(f'status: "{info["status"]}"')
                intro.append(f'**Status:** {info["status"]}')
            if info.get("proposal"):
                intro.append(f'[Proposal]({info["proposal"]})')
            header = "---\n" + "\n".join(frontmatter) + "\n---\n\n"
            if intro:
                header += " · ".join(intro) + "\n\n"
            page = OUT / cycle.name / f"{project.name}.md"
            page.parent.mkdir(parents=True, exist_ok=True)
            page.write_text(header + "\n".join(sections))
            print(f"wrote {page.relative_to(DOCS)} ({len(reports)} reports)")


if __name__ == "__main__":
    main()
