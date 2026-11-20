import { useEffect, useId, useRef } from 'react';
import { Construction, X } from 'lucide-react';
import styles from './TopbarInbox.module.css';

export default function TopbarInbox({ icon: Icon, label, count, emptyHint, isOpen, onToggle, onClose }) {
  const panelId = useId();
  const titleId = useId();
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    titleRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        triggerRef.current?.focus();
      }
    }

    function handlePointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={`${label}: ${count}`}
      >
        <Icon size={14.4} aria-hidden="true" />
        <span className={styles.triggerLabel}>{label}</span>
        <strong aria-hidden="true">{count}</strong>
      </button>

      {isOpen ? (
        <section id={panelId} className={styles.panel} role="dialog" aria-labelledby={titleId}>
          <header className={styles.panelHeader}>
            <h2 id={titleId} ref={titleRef} className={styles.panelTitle} tabIndex={-1}>
              <Icon size={16} aria-hidden="true" />
              {label}
            </h2>
            <button
              type="button"
              className={`ds-icon-button ${styles.closeButton}`}
              onClick={() => {
                onClose();
                triggerRef.current?.focus();
              }}
              aria-label={`Cerrar ${label.toLowerCase()}`}
              title="Cerrar"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </header>

          <div className={styles.panelBody}>
            <span className={styles.constructionIcon} aria-hidden="true">
              <Construction size={28} />
            </span>
            <p className={styles.constructionTitle}>En construcción</p>
            <p className={styles.constructionText}>
              Muy pronto. {emptyHint}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
