import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register({ ...form, phone: form.phone || undefined });
      navigate('/orders');
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <AuthShell>
      <form className="auth" onSubmit={submit}>
        <h2>Create your account</h2>
        <p className="muted">Start placing and tracking orders in seconds.</p>
        <Alert>{error}</Alert>
        <label>
          Name
          <input required value={form.name} onChange={set('name')} />
        </label>
        <label>
          Email
          <input type="email" required value={form.email} onChange={set('email')} />
        </label>
        <label>
          Phone (optional)
          <input value={form.phone} onChange={set('phone')} />
        </label>
        <label>
          Password (min 6 characters)
          <input type="password" minLength={6} required value={form.password} onChange={set('password')} />
        </label>
        <button className="btn primary">Sign up</button>
        <p className="muted small">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
