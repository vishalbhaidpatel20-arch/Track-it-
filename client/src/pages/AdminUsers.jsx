import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert } from '../components/ui.jsx';

const blank = { name: '', email: '', phone: '', password: '', role: 'agent' };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(() => api.get('/admin/users').then((r) => setUsers(r.data.users)), []);
  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/users', { ...form, phone: form.phone || undefined });
      setForm(blank);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const update = async (u, patch) => {
    setError('');
    try {
      await api.patch(`/admin/users/${u._id}`, patch);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <>
      <div className="page-head">
        <h2>Users</h2>
        <button type="button" className="btn primary only-mobile" onClick={() => setOpen(!open)}>
          {open ? 'Close' : '+ Add user'}
        </button>
      </div>
      <form className={`card pad form-inline form-collapsible ${open ? 'open' : ''}`} onSubmit={create}>
        <input required placeholder="Name" value={form.name} onChange={set('name')} />
        <input required type="email" placeholder="Email" value={form.email} onChange={set('email')} />
        <input placeholder="Phone" value={form.phone} onChange={set('phone')} />
        <input required type="password" minLength={6} placeholder="Password" value={form.password} onChange={set('password')} />
        <select value={form.role} onChange={set('role')}>
          <option value="agent">Agent</option>
          <option value="user">Customer</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn primary">Add user</button>
      </form>
      <Alert>{error}</Alert>
      {!users ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td data-label="Name">
                    {u.name}
                    <div className="muted small">{u.phone}</div>
                  </td>
                  <td data-label="Email">{u.email}</td>
                  <td data-label="Role">
                    <select value={u.role} disabled={u._id === me.id} onChange={(e) => update(u, { role: e.target.value })}>
                      <option value="user">Customer</option>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td data-label="Status">
                    <span className={`pill ${u.active ? 'ok' : 'off'}`}>{u.active ? 'Active' : 'Disabled'}</span>
                    {u.role === 'agent' && <span className="pill">{u.available ? 'Free' : 'Busy'}</span>}
                  </td>
                  <td>
                    {u._id !== me.id && (
                      <button className="btn ghost small" onClick={() => update(u, { active: !u.active })}>
                        {u.active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
