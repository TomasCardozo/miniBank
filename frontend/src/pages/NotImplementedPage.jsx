import { Link } from 'react-router';

export default function NotImplementedPage({ title }) {
  return (
    <main>
      <h1>{title}</h1>
      <p>Esta pantalla se implementa en una fase posterior del roadmap frontend.</p>
      <p>
        <Link to="/">Volver al inicio</Link>
      </p>
    </main>
  );
}
