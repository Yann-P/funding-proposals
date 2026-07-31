Welcome! This repository is used to track progress updates for all community-funded proposals approved by the Jupyter Foundation Governing Board.

To keep things simple and transparent, reporting happens directly in GitHub using a lightweight Markdown template and a pull request workflow.

This process is intentionally designed to be minimally time-consuming for both award recipients and reviewers.

## REPO Structure

Each award has its own dedicated folder. \
Each folder contains:

* A reusable **report-template.md**
* A **project.yml** with the project's metadata, used by the [rendered report site](https://jupyter-governance.github.io/funding-proposals) (see below)
* A series of bi-monthly reports submitted via PRs

## project.yml

Each project folder's `project.yml` describes the project for the rendered report site:

```yaml
# yaml-language-server: $schema=../../project.schema.json
title: Jupyter Security
proposal_issue: https://github.com/jupyter-governance/funding-proposals/issues/28
status: In Progress            # Accepted, In Progress, or Done
funding_round: "2026"
reports: "*-report.md"         # a glob, or a list of filenames and/or globs
```

The full schema lives in [project.schema.json](./project.schema.json); the first-line comment gives autocomplete and validation in editors with YAML language server support (e.g. the VS Code YAML extension).

## Reporting Schedule

Reports are required every other month for the duration of the funded work. Due on the last Thursday of the month. 

## How to Submit Your Report

1. Copy the [report-template.md](./2025/report-template.md)
2. Create a new file named: YYYY-MM-report.md _(Example: 2025-02-report.md)_
3. Fill out the template, including the report date in the frontmatter at the top _(Example: `date: "2025-02"`)_
4. Submit a Pull Request

The Governing Board subcommittee will perform a review and merge your PR.

All reporting happens publicly in GitHub to ensure transparency and a consistent record of progress.

## Questions or Support

If you need help with the template, reporting cadence, or the GitHub workflow, open an issue or contact Jupyter Foundations Operations.
