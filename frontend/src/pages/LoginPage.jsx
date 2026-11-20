import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth";
import ErrorMessage from "../components/ErrorMessage";
import "./AuthPage.css";

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
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
      await auth.login(form);
      navigate("/dashboard", { replace: true });
    } catch (apiError) {
      setError(apiError.status === 401 ? "Credenciales Incorrectas" : apiError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-panel">
      <div className="auth-header">
        <p className="auth-kicker">MiniBank</p>
        <h1>Iniciar Sesion</h1>
      </div>

      <form className="auth-form auth-login-form" onSubmit={handleSubmit}>
        <fieldset className="auth-fieldset" disabled={loading}>
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
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Tu password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </p>

          <div className="auth-submit-slot">
            {loading ? (
              <span className="auth-spinner" role="status" aria-label="Iniciando sesion" />
            ) : (
              <button className="auth-primary-button" type="submit">
                Iniciar sesion
              </button>
            )}
          </div>
        </fieldset>
      </form>

      {typeof error === "string" ? (
        <p className="auth-credentials-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : (
        <ErrorMessage error={error} />
      )}

      <p className="auth-switch">
        No tenes cuenta? <Link to="/register">Registrarse</Link>
      </p>
    </div>
  );
}
