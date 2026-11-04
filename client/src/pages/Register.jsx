import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'user' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await register({ ...form, phone: form.phone || undefined });
      if (res.pending) return setPending(true);
      navigate('/orders');
    } catch (err) {
      setError(errMsg(err));
    }
  };

  if (pending) {
    return (
      <AuthShell>
        <div className="auth">
          <h2>Request sent</h2>
          <p className="muted">Your agent registration is awaiting admin approval. You can sign in once an admin approves it.</p>
          <Link to="/login" className="btn primary">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form className="auth" onSubmit={submit}>
        <h2>Create your account</h2>
        <p className="muted">Start placing and tracking orders in seconds.</p>
        <Alert>{error}</Alert>
        <label>
          I am a
          <select value={form.role} onChange={set('role')}>
            <option value="user">Customer (instant access)</option>
            <option value="agent">Delivery agent (needs admin approval)</option>
          </select>
        </label>
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
        <button className="btn primary">{form.role === 'agent' ? 'Request agent account' : 'Sign up'}</button>
        <p className="muted small">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
