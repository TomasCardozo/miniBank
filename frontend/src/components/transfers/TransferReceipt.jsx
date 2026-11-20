import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { formatDateTime, formatMoneyAmount } from '../../utils/formatters';
import { buildReceiptText, getStatusLabel, getStatusToneClassName, isFailureStatus } from './transferReceipt';
import { createReceiptImageFile } from './transferReceiptImage';
import styles from './TransferReceipt.module.css';

const SHARE_TITLE = 'Comprobante de transferencia';

export default function TransferReceipt({ transfer }) {
  const [shareFeedback, setShareFeedback] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const showFailureReason = isFailureStatus(transfer.status) || Boolean(transfer.failureReason);

  useEffect(() => {
    let ignore = false;

    (async () => {
      let file = null;

      try {
        file = await createReceiptImageFile(transfer);
      } catch {
        file = null;
      }

      if (!ignore) {
        setReceiptFile(file || null);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [transfer]);

  async function handleShare() {
    const receiptText = buildReceiptText(transfer);
    setShareFeedback('');

    if (receiptFile && navigator.canShare?.({ files: [receiptFile] })) {
      try {
        await navigator.share({ files: [receiptFile], title: SHARE_TITLE, text: receiptText });
      } catch {
      }

      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, text: receiptText });
      } catch {
      }

      return;
    }

    if (receiptFile) {
      downloadFile(receiptFile);
      setShareFeedback('Descargamos la imagen del comprobante para que puedas compartirla.');
      return;
    }

    try {
      await navigator.clipboard.writeText(receiptText);
      setShareFeedback('Copiamos el comprobante al portapapeles.');
    } catch {
      setShareFeedback('No pudimos compartir el comprobante. Intentá de nuevo.');
    }
  }

  return (
    <div className={styles.receipt}>
      <p className={styles.receiptBrand}>MiniBank</p>

      <p className={`${styles.receiptAmount} amount-xl`}>{formatMoneyAmount(transfer.amount, transfer.currency)}</p>

      <dl className={styles.receiptList}>
        <dt>Origen</dt>
        <dd>{transfer.sourceAccountNumber}</dd>
        <dt>Destino</dt>
        <dd>{transfer.targetAccountNumber}</dd>
        <dt>Fecha</dt>
        <dd>{formatDateTime(transfer.createdAt)}</dd>
        <dt>Estado</dt>
        <dd>
          <span className={`ds-badge ${getStatusToneClassName(transfer.status)}`}>{getStatusLabel(transfer.status)}</span>
        </dd>
        {showFailureReason ? (
          <>
            <dt>Motivo de fallo</dt>
            <dd>{transfer.failureReason || '-'}</dd>
          </>
        ) : null}
      </dl>

      <p className={styles.receiptId}>
        <span className={styles.receiptIdLabel}>ID de transferencia</span>
        <span className={styles.receiptIdValue}>{transfer.id}</span>
      </p>

      <div className={styles.receiptActions}>
        <button type="button" className="ds-button ds-button-secondary" onClick={() => window.print()}>
          <Download size={15} aria-hidden="true" />
          Descargar comprobante
        </button>
        <button type="button" className="ds-button ds-button-secondary" onClick={handleShare}>
          <Share2 size={15} aria-hidden="true" />
          Compartir
        </button>
      </div>

      {shareFeedback ? <p className={styles.shareFeedback}>{shareFeedback}</p> : null}
    </div>
  );
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');

  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
