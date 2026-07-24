/**
 * MyST plugin adding a `sortable-table` display for {listing} plus the
 * client-side JS that makes its headers click-to-sort.
 *
 * Build side: myst-listing's render transform leaves `:display:` values it
 * doesn't recognize for other plugins to claim (see its docs/extending.md).
 * The transform here claims `sortable-table` placeholders and renders the same
 * table as the stock display, with one addition: when an item has a
 * "<column> sortkey" field alongside "<column>", the key is carried on the
 * <td> itself as a class token (<td class="myst-sortkey-2026-07-02">) — the
 * only per-cell metadata the myst-theme renderer passes through to the DOM
 * (data-* attributes are dropped; see myst-to-react's tableCell renderer).
 * The page therefore ships explicit, deterministic sort keys in static HTML —
 * invisible without JavaScript, machine-readable with it.
 *
 * Client side: headers become clickable and rows re-order in the light DOM —
 * the same enhancement pattern (and React-clobbering trade-off) as
 * myst-tabulator and myst-lightbox. Cells sort by their encoded key when one
 * is present, falling back to visible text. Comparison is a single
 * numeric-aware string compare (numbers order numerically, everything else
 * lexicographically); any domain-specific ordering belongs in the sort keys
 * the site generator emits, not in this plugin.
 */

// Dynamic import because this file is also evaluated in the browser, where
// `node:path` can't be resolved.
let pathMod;
try { pathMod = await import('node:path'); } catch {}
const PLUGIN_PATH = new URL(import.meta.url).pathname;

// Default scope: article content only, so theme chrome isn't enhanced.
const DEFAULT_INCLUDE = 'article.article table, main table';

const SORTKEY_CLASS_PREFIX = 'myst-sortkey-';
const INITIAL_SORT_CLASS_PREFIX = 'myst-sort-initial-';

/* ------------------------- build-side: the display ------------------------ */

// Mirrors myst-listing's sort spec: 'field', 'field-asc', 'field-desc';
// only a trailing -asc/-desc is a direction.
function parseSort(sort) {
  const dash = sort.lastIndexOf('-');
  const suffix = dash >= 0 ? sort.slice(dash + 1) : '';
  const hasOrder = suffix === 'asc' || suffix === 'desc';
  return {
    field: hasOrder ? sort.slice(0, dash) : sort,
    ascending: suffix !== 'desc',
  };
}

// Empties sort last regardless of direction.
function sortItems(items, { field, ascending }) {
  return [...items].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    const c = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return ascending ? c : -c;
  });
}

function buildTable(items, columns, sort) {
  const header = {
    type: 'tableRow',
    children: columns.map((col) => {
      const cell = {
        type: 'tableCell',
        header: true,
        children: [{ type: 'text', value: col.charAt(0).toUpperCase() + col.slice(1) }],
      };
      // Mark the column the build already sorted by, so the client-side
      // enhancer can show the sort indicator from first paint.
      if (sort.field === col || sort.field === `${col} sortkey`) {
        cell.class = `${INITIAL_SORT_CLASS_PREFIX}${sort.ascending ? 'ascending' : 'descending'}`;
      }
      return cell;
    }),
  };
  const rows = items.map((item) => ({
    type: 'tableRow',
    class: 'myst-listing-item',
    children: columns.map((col) => {
      const text = String(item[col] ?? '');
      let children = [{ type: 'text', value: text }];
      if (col === 'title' && item.url) {
        children = [{ type: 'link', url: item.url, children }];
      }
      // A space-free "<column> sortkey" item field rides on the cell as a
      // class token, the only custom metadata that reaches the rendered <td>.
      const key = item[`${col} sortkey`];
      const cell = { type: 'tableCell', children };
      if (key != null && String(key).trim() !== '') {
        cell.class = `${SORTKEY_CLASS_PREFIX}${key}`;
      }
      return cell;
    }),
  }));
  return { type: 'table', class: 'myst-listing', children: [header, ...rows] };
}

const sortableTableDisplay = {
  name: 'listing-sortable-table',
  stage: 'document',
  doc: 'Render {listing} placeholders with :display: sortable-table as a table with encoded sort keys.',
  plugin: (_opts, utils) => (tree, vfile) => {
    for (const node of utils.selectAll('listingPlaceholder', tree)) {
      if (node.display !== 'sortable-table') continue;
      if (node.error || node.items === undefined) continue; // collector hasn't run; listing warns later
      const sort = parseSort(node.sort || 'title-asc');
      const items = sortItems(node.items, sort).slice(0, node.limit || 10);
      const table = buildTable(items, node.columns || ['title'], sort);
      for (const key of Object.keys(node)) if (key !== 'type') delete node[key];
      Object.assign(node, table);
    }
  },
};

/* ---------------------- client side: click-to-sort ----------------------- */

// A cell's sort key: an explicit data-sortkey attribute (hand-written HTML),
// then a myst-sortkey-* class token on the cell, then the visible text.
function cellKey(cell) {
  if (!cell) return '';
  if (cell.dataset?.sortkey != null) return cell.dataset.sortkey.trim();
  for (const token of cell.classList) {
    if (token.startsWith(SORTKEY_CLASS_PREFIX)) {
      return token.slice(SORTKEY_CLASS_PREFIX.length);
    }
  }
  return (cell.textContent ?? '').trim();
}

const INDICATOR_CSS = `
  th[data-myst-sortable] { cursor: pointer; user-select: none; white-space: nowrap; }
  th[data-myst-sortable]::after { content: " ↕"; opacity: 0.35; font-size: 0.8em; }
  th[data-myst-sortable][aria-sort="ascending"]::after { content: " ↑"; opacity: 0.8; }
  th[data-myst-sortable][aria-sort="descending"]::after { content: " ↓"; opacity: 0.8; }
`;

function sortBy(headerCells, rows, index) {
  const th = headerCells[index];
  const direction = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
  for (const other of headerCells) other.removeAttribute('aria-sort');
  th.setAttribute('aria-sort', direction === 1 ? 'ascending' : 'descending');

  const sorted = rows.slice().sort((rowA, rowB) => {
    const a = cellKey(rowA.cells[index]);
    const b = cellKey(rowB.cells[index]);
    // Empty cells stay at the bottom regardless of direction.
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return direction * a.localeCompare(b, undefined, { numeric: true });
  });
  const parent = sorted[0].parentElement;
  for (const row of sorted) parent.appendChild(row);
}

function enhance(table) {
  const headerRow = table.querySelector('tr');
  const headerCells = headerRow ? Array.from(headerRow.querySelectorAll('th')) : [];
  if (!headerCells.length) return;
  const rows = Array.from(table.querySelectorAll('tr')).filter(
    (row) => row !== headerRow && row.querySelector('td'),
  );
  if (rows.length < 2) return;

  headerCells.forEach((th, index) => {
    th.dataset.mystSortable = '1';
    th.tabIndex = 0;
    th.setAttribute('role', 'button');
    const run = () => sortBy(headerCells, rows, index);
    th.addEventListener('click', run);
    th.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        run();
      }
    });
    // Surface the build-time sort (marked by the display transform) as the
    // active indicator; the rows already arrive in that order.
    for (const token of th.classList) {
      if (token.startsWith(INITIAL_SORT_CLASS_PREFIX)) {
        th.setAttribute('aria-sort', token.slice(INITIAL_SORT_CLASS_PREFIX.length));
      }
    }
  });
}

// Tracks tables we've already enhanced. Module-scoped so repeated render()
// calls (hot reload, route remounts) don't stack duplicate listeners.
const enhanced = new WeakSet();

async function render({ model, el }) {
  el.style.display = 'none';

  const include = (model.get('include') || '').trim() || DEFAULT_INCLUDE;
  const exclude = (model.get('exclude') || '').trim();

  if (!document.querySelector('style[data-myst-sortable]')) {
    const style = document.createElement('style');
    style.dataset.mystSortable = '1';
    style.textContent = INDICATOR_CSS;
    document.head.appendChild(style);
  }

  function enhanceMatching() {
    const excluded = exclude ? new Set(document.querySelectorAll(exclude)) : null;
    for (const table of document.querySelectorAll(include)) {
      if (excluded?.has(table)) continue;
      if (enhanced.has(table)) continue;
      enhanced.add(table);
      enhance(table);
    }
  }

  // Re-enhance when the theme re-renders or the route changes.
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; enhanceMatching(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  enhanceMatching();
  for (const delay of [500, 1500, 4000]) setTimeout(enhanceMatching, delay);
}

const sortableDirective = {
  name: 'sortable',
  doc: 'Add click-to-sort headers to every table in the article body. Scope with :selector-include: / :selector-exclude:.',
  options: {
    'selector-include': {
      type: String,
      doc: `CSS selector for tables to enhance. Default: ${DEFAULT_INCLUDE}`,
    },
    'selector-exclude': {
      type: String,
      doc: 'CSS selector for tables to skip.',
    },
  },
  run(data, vfile) {
    const opts = data.options ?? {};
    return [{
      type: 'anywidget',
      esm: pathMod.relative(pathMod.dirname(vfile.path), PLUGIN_PATH),
      model: {
        include: opts['selector-include'] ?? '',
        exclude: opts['selector-exclude'] ?? '',
      },
      id: crypto.randomUUID(),
    }];
  },
};

export default {
  name: 'sortable',
  directives: [sortableDirective],
  transforms: [sortableTableDisplay],
  render,
};
