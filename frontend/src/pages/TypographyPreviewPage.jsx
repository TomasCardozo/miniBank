const samples = [
  {
    className: 'h1',
    label: 'h1',
    text: 'Bienvenido a MiniBank',
  },
  {
    className: 'h2',
    label: 'h2',
    text: 'Resumen de cuentas',
  },
  {
    className: 'h3',
    label: 'h3',
    text: 'Cuenta principal',
  },
  {
    className: 'h4',
    label: 'h4',
    text: 'Movimientos recientes',
  },
  {
    className: 'body-lg',
    label: 'body-lg',
    text: 'Texto destacado para explicar una accion importante dentro del producto.',
  },
  {
    className: 'body',
    label: 'body',
    text: 'Texto estandar de interfaz para parrafos, formularios y mensajes del sistema.',
  },
  {
    className: 'body-sm',
    label: 'body-sm',
    text: 'Texto secundario para ayuda contextual y detalles de bajo enfasis.',
  },
  {
    className: 'caption',
    label: 'caption',
    text: 'Actualizado hace 5 minutos',
  },
  {
    className: 'label',
    label: 'label',
    text: 'CUENTA DESTINO',
  },
  {
    className: 'amount-xl',
    label: 'amount-xl',
    text: '$ 125.430,90',
  },
  {
    className: 'amount-lg',
    label: 'amount-lg',
    text: '$ 24.900,00',
  },
  {
    className: 'amount',
    label: 'amount',
    text: '$ 1.250,75',
  },
  {
    className: 'amount-sm',
    label: 'amount-sm',
    text: '$ 120,00',
  },
];

export default function TypographyPreviewPage() {
  return (
    <main>
      <section className="ds-card">
        <h1 className="h1">Sistema tipografico</h1>
        <p className="body-lg">Preview de la escala definida para MiniBank.</p>
      </section>

      <section className="ds-card">
        <h2 className="h2">Escala completa</h2>
        <div className="typography-preview-list">
          {samples.map((sample) => (
            <article className="ds-card typography-preview-item" key={sample.className}>
              <p className="caption">.{sample.label}</p>
              <p className={sample.className}>{sample.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
