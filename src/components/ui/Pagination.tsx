/**
 * Pagination — spec §6.11. Previous/Next always present; numbered pages collapse
 * with ellipses; the current page is marked with aria-current.
 * On small screens only "Page X of Y" plus Previous/Next are shown.
 */
import { Icon } from "./Icon";
import "./Pagination.css";

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  label?: string;
}

export function pageWindow(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({ page, pageCount, onChange, label = "Pagination" }: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <nav className="ds-pagination" aria-label={label}>
      <button type="button" className="ds-pagination__step" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <Icon name="chevronLeft" size={18} />
        <span>Previous</span>
      </button>

      <ol className="ds-pagination__pages">
        {pageWindow(page, pageCount).map((p, i) =>
          p === "…" ? (
            <li key={`gap-${i}`} className="ds-pagination__gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className="ds-pagination__page"
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            </li>
          )
        )}
      </ol>
      <p className="ds-pagination__summary">
        Page {page} of {pageCount}
      </p>

      <button type="button" className="ds-pagination__step" onClick={() => onChange(page + 1)} disabled={page >= pageCount}>
        <span>Next</span>
        <Icon name="chevronRight" size={18} />
      </button>
    </nav>
  );
}
