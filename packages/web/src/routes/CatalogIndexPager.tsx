import { Link } from "react-router";

export interface CatalogIndexPagerProps {
  page: number;
  pages: number;
  href: (page: number) => string;
}

/**
 * Previous and next links around "Page n of m", drawn only where there is a second page and
 * `page` is one of them.
 */
export function CatalogIndexPager({ page, pages, href }: CatalogIndexPagerProps) {
  if (pages <= 1 || page > pages) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-row">
      {page > 1 && <Link to={href(page - 1)}>← Previous</Link>}
      <span className="text-muted">
        Page {page} of {pages}
      </span>
      {page < pages && <Link to={href(page + 1)}>Next →</Link>}
    </nav>
  );
}
