import styles from './Dashboard.module.css';

export default function SummaryCard({ title, value, description, icon, numeric = false }) {
  const Icon = icon;

  return (
    <article className={`ds-card grid gap-3 ${styles.summaryCard}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="label text-main mb-0">{title}</h2>
        {Icon ? (
          <span className={styles.cardIcon} aria-hidden="true">
            <Icon size={16} />
          </span>
        ) : null}
      </div>
      <p className={`text-main mb-0 ${numeric ? `amount-lg ${styles.numericValue}` : 'h4'}`}>{value}</p>
      <p className="body-sm text-muted mb-0">{description}</p>
    </article>
  );
}
