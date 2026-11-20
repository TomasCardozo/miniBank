import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ErrorMessage from './ErrorMessage';

describe('ErrorMessage', () => {
  it('renders nothing without an error', () => {
    const { container } = render(<ErrorMessage error={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the backend error contract fields', () => {
    render(
      <ErrorMessage
        error={{
          message: 'No tiene permisos',
          status: 403,
          code: 'FORBIDDEN',
          path: '/admin/users',
        }}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('No tiene permisos')).toBeInTheDocument();
    expect(screen.getByText('Status HTTP: 403')).toBeInTheDocument();
    expect(screen.getByText('Codigo: FORBIDDEN')).toBeInTheDocument();
    expect(screen.getByText('Path: /admin/users')).toBeInTheDocument();
  });

  it('shows extra backend details without duplicating top-level fields', () => {
    render(
      <ErrorMessage
        error={{
          message: 'Request invalido',
          status: 400,
          details: {
            message: 'duplicated',
            code: 'duplicated',
            path: 'duplicated',
            fieldErrors: ['email requerido', 'password corto'],
            metadata: { reason: 'validation' },
          },
        }}
      />
    );

    expect(screen.getByText('fieldErrors: email requerido, password corto')).toBeInTheDocument();
    expect(screen.getByText('metadata: {"reason":"validation"}')).toBeInTheDocument();
    expect(screen.queryByText('message: duplicated')).not.toBeInTheDocument();
  });

  it('falls back to a generic message', () => {
    render(<ErrorMessage error={{ status: 500 }} />);

    expect(screen.getByText('Ocurrio un error inesperado.')).toBeInTheDocument();
  });
});
