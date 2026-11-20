import { buildAuditDetailItems, parseAuditDetails } from './auditDetails';

const VISIBLE_ITEMS_WHEN_COLLAPSED = 2;
const MAX_ITEMS_WITHOUT_COLLAPSE = 3;

export default function AuditDetails({ details, classNames = {} }) {
  const parsed = parseAuditDetails(details);

  if (parsed.type === 'empty') {
    return <span className={classNames.muted}>-</span>;
  }

  if (parsed.type === 'text') {
    return <p className={classNames.detailsText}>{parsed.text}</p>;
  }

  const items = buildAuditDetailItems(parsed.pairs);

  if (items.length > MAX_ITEMS_WITHOUT_COLLAPSE) {
    const visibleItems = items.slice(0, VISIBLE_ITEMS_WHEN_COLLAPSED);
    const hiddenItems = items.slice(VISIBLE_ITEMS_WHEN_COLLAPSED);

    return (
      <div className={classNames.details}>
        <DetailList items={visibleItems} classNames={classNames} />
        <details className={classNames.detailsMore}>
          <summary>Ver todo</summary>
          <DetailList items={hiddenItems} classNames={classNames} />
        </details>
      </div>
    );
  }

  return (
    <div className={classNames.details}>
      <DetailList items={items} classNames={classNames} />
    </div>
  );
}

function DetailList({ items, classNames }) {
  return (
    <dl className={classNames.detailList}>
      {items.map((item) => (
        <div key={item.key} className={classNames.detailChip}>
          <dt>{item.label}:</dt>
          <dd>
            {item.kind === 'change' ? (
              <>
                <DetailValue value={item.previous} /> → <DetailValue value={item.next} />
              </>
            ) : (
              <DetailValue value={item.value} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DetailValue({ value }) {
  return <span title={value.title}>{value.text}</span>;
}
