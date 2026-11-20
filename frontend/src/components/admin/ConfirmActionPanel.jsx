import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './ConfirmActionPanel.module.css';

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

export default function ConfirmActionPanel({
  title,
  description,
  confirmLabel,
  busyLabel,
  busy = false,
  tone = 'neutral',
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const busyRef = useRef(busy);
  const onCancelRef = useRef(onCancel);

  busyRef.current = busy;
  onCancelRef.current = onCancel;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    titleRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busyRef.current) {
          onCancelRef.current?.();
        }
        return;
      }

      if (event.key === 'Tab') {
        trapFocus(event, dialogRef.current);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  const isDanger = tone === 'danger';

  function handleBackdropMouseDown(event) {
    if (event.target === event.currentTarget && !busy) {
      onCancel();
    }
  }

  return createPortal(
    <div className={styles.backdrop} onMouseDown={handleBackdropMouseDown}>
      <section
        ref={dialogRef}
        className={`${styles.dialog} ${isDanger ? styles.danger : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy || undefined}
      >
        <h3 id={titleId} ref={titleRef} className={styles.title} tabIndex={-1}>
          {title}
        </h3>
        {description ? (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button className="ds-button ds-button-secondary" type="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            className={`ds-button ${isDanger ? styles.dangerButton : 'ds-button-primary'}`}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

function trapFocus(event, dialog) {
  if (!dialog) {
    return;
  }

  const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE));

  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && (active === first || !dialog.contains(active) || active === dialog.querySelector('h3'))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}
