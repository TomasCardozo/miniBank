import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import "./AuthPage.css";

export default function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    documentNumber: "",
    password: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await auth.register(form);
      navigate("/me");
    } catch (apiError) {
      setError(apiError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-panel">
      <div className="auth-header">
        <p className="auth-kicker">MiniBank</p>
        <h1>Registro</h1>
        <p>Crea tu usuario.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <fieldset className="auth-fieldset" disabled={loading}>
          <p className="auth-field">
            <label htmlFor="firstName">Nombre</label>
            <input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              placeholder="Adam"
              value={form.firstName}
              onChange={handleChange}
              required
            />
          </p>

          <p className="auth-field">
            <label htmlFor="lastName">Apellido</label>
            <input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              placeholder="Smith"
              value={form.lastName}
              onChange={handleChange}
              required
            />
          </p>

          <p className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </p>

          <p className="auth-field">
            <label htmlFor="documentNumber">Documento</label>
            <input
              id="documentNumber"
              name="documentNumber"
              placeholder="12345678"
              value={form.documentNumber}
              onChange={handleChange}
              required
            />
          </p>

          <p className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Minimo 8 caracteres"
              minLength={8}
              maxLength={72}
              value={form.password}
              onChange={handleChange}
              required
            />
          </p>

          <button className="auth-primary-button" type="submit">
            Registrarse
          </button>
        </fieldset>
      </form>

      {loading ? <Loading /> : null}
      <ErrorMessage error={error} />

      <p className="auth-switch">
        Ya tenes cuenta? <Link to="/login">Iniciar sesion</Link>
      </p>
    </div>
  );
}
