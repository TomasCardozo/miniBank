import { AlertCircle } from 'lucide-react';
import { resolveTransferError } from './transferErrorMessages';
import styles from './TransferErrorCard.module.css';

export default function TransferErrorCard({ error }) {
  if (!error) {
    return null;
  }

  return (
    <section className={styles.errorCard} role="alert">
      <AlertCircle className={styles.errorIcon} size={20} aria-hidden="true" />
      <p className={styles.errorText}>{resolveTransferError(error)}</p>
    </section>
  );
}
