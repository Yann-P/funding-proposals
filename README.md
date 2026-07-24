# Jupyter Foundation Funding Proposals

This repository is a home for issues for coordinating writing around Jupyter Foundation funding proposals. See https://compass.jupyterfoundation.org/funding/process/ for more information.

## How to submit a proposal

1. [Open an issue here](https://github.com/jupyter-governance/funding-proposals/issues/new/choose)
2. Follow [the proposal process here](https://compass.jupyterfoundation.org/funding/process/)

## How to increase the chance of getting funding

See [these tips for writing a proposal](https://jupyter-governance.github.io/jupyter-foundation-governing-board/funding/process/#tips-for-writing-a-proposal).

## Where proposals are tracked

We use [this proposal tracking board](https://github.com/orgs/jupyter-governance/projects/13) to track proposals.

## Where is this process defined?

The [funding process page](https://compass.jupyterfoundation.org/funding/process/) on the Foundation team compass is the source of truth for this process.

## Progress reports

Progress reports for funded proposals live in the [`Reports/`](Reports/) folder and are rendered at [jupyter-governance.github.io/funding-proposals](https://jupyter-governance.github.io/funding-proposals).
See the [Reports README](Reports/README.md) for how to submit a report.

## Build the report site

The site in `docs/` is built with [MyST](https://mystmd.org) and deployed to GitHub Pages automatically on merge to `main`.
To build it locally, install [nox](https://nox.thea.codes) and run:

```bash
nox -s docs       # build static HTML in docs/_build/html
nox -s docs-live  # start a live-reloading dev server
```
