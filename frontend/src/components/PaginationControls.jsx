export default function PaginationControls({ page, totalPages, totalElements, loading, disabled, onPageChange, ariaLabel, pageLabel = 'Página' }) {
  const currentPage = page ?? 0;
  const pageCount = totalPages || 0;
  const hasMultiplePages = pageCount > 1;

  return (
    <nav className="ds-pagination flex flex-wrap items-center gap-3 mt-4 p-3 border border-default rounded-md bg-surface-muted" aria-label={ariaLabel || 'Paginacion'}>
      <p className="mb-0 flex-1 min-w-0">
        {pageLabel} {currentPage + 1} de {pageCount || 1}. Total: {totalElements ?? 0}
      </p>
      {hasMultiplePages ? (
        <>
          <span className="flex flex-wrap items-center gap-2">
            <button
              className="ds-button ds-button-secondary"
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={disabled || loading || currentPage <= 0}
            >
              Anterior
            </button>
            <button
              className="ds-button ds-button-secondary"
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={disabled || loading || currentPage >= pageCount - 1}
            >
              Siguiente
            </button>
          </span>
          <span className="flex-1" aria-hidden="true" />
        </>
      ) : null}
    </nav>
  );
}
