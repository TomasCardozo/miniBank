import { TRANSFER_STATUSES } from '../../constants/enums';
import { TRANSFER_PAGE_SIZE_OPTIONS, TRANSFER_SORT_OPTIONS } from './transferListConfig';

export default function TransferFiltersForm({
  filters,
  onFilterChange,
  onSubmit,
  onClearFilters,
  accountFilter,
  className,
  fieldClassName,
  actionsClassName,
}) {
  const fieldClasses = ['ds-field', fieldClassName].filter(Boolean).join(' ');

  return (
    <form onSubmit={onSubmit} className={className}>
      <p className={fieldClasses}>
        <label htmlFor="status">Estado</label>
        <select id="status" name="status" value={filters.status} onChange={onFilterChange} className="ds-input">
          <option value="">Todos</option>
          {TRANSFER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </p>

      <p className={fieldClasses}>
        <label htmlFor="from">Desde</label>
        <input id="from" name="from" type="datetime-local" value={filters.from} onChange={onFilterChange} className="ds-input" />
      </p>

      <p className={fieldClasses}>
        <label htmlFor="to">Hasta</label>
        <input id="to" name="to" type="datetime-local" value={filters.to} onChange={onFilterChange} className="ds-input" />
      </p>

      {accountFilter}

      <p className={fieldClasses}>
        <label htmlFor="size">Tamano de pagina</label>
        <select id="size" name="size" value={filters.size} onChange={onFilterChange} className="ds-input">
          {TRANSFER_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </p>

      <p className={fieldClasses}>
        <label htmlFor="sort">Orden</label>
        <select id="sort" name="sort" value={filters.sort} onChange={onFilterChange} className="ds-input">
          {TRANSFER_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </p>

      <div className={actionsClassName}>
        <button type="submit" className="ds-button ds-button-primary">
          Aplicar filtros
        </button>
        <button type="button" onClick={onClearFilters} className="ds-button ds-button-secondary">
          Limpiar filtros
        </button>
      </div>
    </form>
  );
}
