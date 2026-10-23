import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';

const HOME = { user: '/orders', agent: '/deliveries', admin: '/admin' };
const DEMOS = [
  ['Customer', 'user@demo.com'],
  ['Agent', 'agent1@demo.com'],
  ['Admin', 'admin@demo.com'],
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={HOME[user.role]} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await login(form);
      navigate(HOME[u.role]);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form className="auth" onSubmit={submit}>
        <h2>Welcome back</h2>
        <p className="muted">Sign in to track and manage deliveries.</p>
        <Alert>{error}</Alert>
        <label>
          Email
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Password
          <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted small">
          New customer? <Link to="/register">Create an account</Link>
        </p>
        <div className="demo">
          <span className="muted small">Demo accounts (password: password123)</span>
          <div className="row">
            {DEMOS.map(([label, email]) => (
              <button type="button" key={email} className="btn ghost small" onClick={() => setForm({ email, password: 'password123' })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
