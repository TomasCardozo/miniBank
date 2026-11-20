import { formatDateTime, formatMoneyAmount } from '../../utils/formatters';
import { getStatusLabel, isFailureStatus } from './transferReceipt';

const WIDTH = 720;
const SCALE = 2;
const PADDING = 56;
const ROW_HEIGHT = 46;

export async function createReceiptImageFile(transfer, fileName = 'comprobante-minibank.png') {
  const blob = await createReceiptImageBlob(transfer);

  if (!blob) {
    return null;
  }

  return new File([blob], fileName, { type: 'image/png' });
}

export async function createReceiptImageBlob(transfer) {
  const rows = buildRows(transfer);
  const height = PADDING * 2 + 320 + rows.length * ROW_HEIGHT;
  const canvas = document.createElement('canvas');

  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;

  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.scale(SCALE, SCALE);
  await waitForFonts();
  paintReceipt(context, transfer, rows, height);

  return canvasToBlob(canvas);
}

function buildRows(transfer) {
  const rows = [
    ['Origen', transfer.sourceAccountNumber],
    ['Destino', transfer.targetAccountNumber],
    ['Fecha', formatDateTime(transfer.createdAt)],
    ['Estado', getStatusLabel(transfer.status)],
  ];

  if (isFailureStatus(transfer.status) || transfer.failureReason) {
    rows.push(['Motivo de fallo', transfer.failureReason || '-']);
  }

  return rows;
}

function paintReceipt(context, transfer, rows, height) {
  const tokens = readTokens();
  const centerX = WIDTH / 2;

  context.fillStyle = tokens.surface;
  context.fillRect(0, 0, WIDTH, height);

  context.strokeStyle = tokens.border;
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, WIDTH - 1, height - 1);

  context.textAlign = 'center';
  context.fillStyle = tokens.primary;
  context.font = `600 26px ${tokens.displayFont}`;
  context.fillText('MiniBank', centerX, PADDING + 10);

  paintSuccessMark(context, tokens, centerX, PADDING + 86);

  context.fillStyle = tokens.primary;
  context.font = `500 40px ${tokens.numericFont}`;
  context.fillText(formatMoneyAmount(transfer.amount, transfer.currency), centerX, PADDING + 184);

  context.fillStyle = tokens.textMuted;
  context.font = `400 15px ${tokens.bodyFont}`;
  context.fillText('Comprobante de transferencia', centerX, PADDING + 214);

  let rowY = PADDING + 262;
  paintDivider(context, tokens, rowY - 30);

  rows.forEach(([label, value]) => {
    context.textAlign = 'left';
    context.fillStyle = tokens.textMuted;
    context.font = `400 15px ${tokens.bodyFont}`;
    context.fillText(label, PADDING, rowY);

    context.textAlign = 'right';
    context.fillStyle = tokens.text;
    context.font = `400 16px ${tokens.bodyFont}`;
    context.fillText(String(value ?? '-'), WIDTH - PADDING, rowY);

    rowY += ROW_HEIGHT;
  });

  paintDivider(context, tokens, rowY - 20);

  context.textAlign = 'left';
  context.fillStyle = tokens.textMuted;
  context.font = `400 13px ${tokens.bodyFont}`;
  context.fillText('ID de transferencia', PADDING, rowY + 14);

  context.font = `400 14px ${tokens.numericFont}`;
  context.fillText(String(transfer.id ?? '-'), PADDING, rowY + 38);
}

function paintSuccessMark(context, tokens, centerX, centerY) {
  context.beginPath();
  context.arc(centerX, centerY, 34, 0, Math.PI * 2);
  context.fillStyle = tokens.successBg;
  context.fill();

  context.beginPath();
  context.moveTo(centerX - 14, centerY + 1);
  context.lineTo(centerX - 4, centerY + 11);
  context.lineTo(centerX + 15, centerY - 11);
  context.strokeStyle = tokens.primary;
  context.lineWidth = 4;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
}

function paintDivider(context, tokens, y) {
  context.beginPath();
  context.moveTo(PADDING, y);
  context.lineTo(WIDTH - PADDING, y);
  context.strokeStyle = tokens.border;
  context.lineWidth = 1;
  context.stroke();
}

function readTokens() {
  const styles = getComputedStyle(document.documentElement);
  const token = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;

  return {
    surface: token('--color-surface', '#ffffff'),
    border: token('--color-border', '#d7ded8'),
    text: token('--color-text', '#101715'),
    textMuted: token('--color-text-muted', '#52645f'),
    primary: token('--color-primary-strong', '#003f30'),
    successBg: token('--color-success-bg', '#e8f6ef'),
    displayFont: token('--font-display', 'serif'),
    bodyFont: token('--font-body', 'sans-serif'),
    numericFont: token('--font-numeric', 'monospace'),
  };
}

async function waitForFonts() {
  try {
    await document.fonts?.ready;
  } catch {
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }

    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
