import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { fmt, LoadError, StatusBadge, useLiveReload } from '../components/ui.jsx';

const STATUS_COLORS = {
  Placed: '#3b82f6',
  'Picked-up': '#f59e0b',
  'In-Transit': '#f97316',
  Delivered: '#22c55e',
  Cancelled: '#ef4444',
};

const Kpi = ({ label, value, hint, icon, tone = 'blue' }) => (
  <div className="card kpi">
    <span className={`kpi-icon tone-${tone}`}>{icon}</span>
    <div>
      <div className="muted small">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  </div>
);

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [r, setR] = useState(null);
  const [orders, setOrders] = useState([]);
  const [agents, setAgents] = useState([]);

  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    try {
      const [rep, ord, ag] = await Promise.all([api.get('/admin/reports'), api.get('/orders'), api.get('/admin/users?role=agent')]);
      setR(rep.data);
      setOrders(ord.data.orders);
      setAgents(ag.data.users);
      setLoadError('');
    } catch (e) {
      setLoadError(errMsg(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useLiveReload(load);

  if (!r) return loadError ? <LoadError message={loadError} onRetry={load} /> : <p className="muted">Loading…</p>;
  const statuses = Object.keys(STATUS_COLORS);
  const pie = statuses.map((s) => ({ name: s, value: r.byStatus[s] || 0 })).filter((d) => d.value > 0);
  const unassigned = orders.filter((o) => o.status === 'Placed' && !o.agent).length;

  return (
    <>
      <div className="dash-hero">
        <div className="hero-text">
          <span className="hero-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
          <h2>
            {greeting()}, <span className="hero-name">{user.name.split(' ')[0]}</span>
          </h2>
          <p>
            {unassigned > 0
              ? `${unassigned} order${unassigned > 1 ? 's' : ''} waiting for an agent. Assign one to get things moving.`
              : 'Everything is assigned. Deliveries are running smoothly.'}
          </p>
          <div className="row hero-actions">
            <Link className="btn solid" to="/admin/orders">
              Assign orders
            </Link>
            <Link className="btn" to="/admin/live">
              Open live map
            </Link>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <b>{r.activeDeliveries}</b>
            <span>Active now</span>
          </div>
          <div>
            <b>{unassigned}</b>
            <span>Awaiting agent</span>
          </div>
          <div>
            <b>{r.onTimeRate}%</b>
            <span>On-time</span>
          </div>
        </div>
      </div>

      <div className="kpis">
        <Kpi icon={<Icon name="truck" />} tone="orange" label="Active deliveries" value={r.activeDeliveries} hint="Picked-up or in transit" />
        <Kpi icon={<Icon name="clock" />} tone="green" label="On-time delivery rate" value={`${r.onTimeRate}%`} hint="Delivered before due time" />
        <Kpi icon={<Icon name="clock" />} tone="blue" label="Avg delivery duration" value={`${r.avgDeliveryMinutes} min`} hint="Pickup → delivered" />
        <Kpi icon={<Icon name="target" />} tone="violet" label="Tracking accuracy" value={`${r.trackingAccuracy}%`} hint="Live deliveries with fresh GPS" />
        <Kpi icon={<Icon name="star" />} tone="amber" label="Customer satisfaction" value={r.ratingCount ? `${r.csat} / 5` : '—'} hint={`${r.ratingCount} ratings`} />
        <Kpi icon={<Icon name="box" />} tone="blue" label="Total orders" value={r.totalOrders} hint={`${r.byStatus.Delivered || 0} delivered`} />
      </div>

      <div className="grid-3">
        <div className="card pad">
          <div className="section-title">
            <h3>Orders · last 7 days</h3>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={r.daily}>
              <defs>
                <linearGradient id="gOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gDel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="orders" stroke="#0d9488" strokeWidth={2.5} fill="url(#gOrders)" />
              <Area type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2.5} fill="url(#gDel)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card pad">
          <h3>Orders by status</h3>
          {pie.length === 0 ? (
            <p className="muted">No orders yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={pie} dataKey="value" innerRadius={48} outerRadius={75} paddingAngle={3} stroke="none">
                  {pie.map((d) => (
                    <Cell key={d.name} fill={STATUS_COLORS[d.name]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="legend">
            {statuses.map((s) => (
              <div key={s}>
                <i style={{ background: STATUS_COLORS[s] }} />
                {s}
                <b>{r.byStatus[s] || 0}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="card pad">
          <div className="section-title">
            <h3>Agents</h3>
            <Link className="small" to="/admin/users">
              Manage
            </Link>
          </div>
          {agents.length === 0 && <p className="muted small">No agents yet.</p>}
          {agents.map((a) => {
            const state = !a.active ? 'off' : a.available ? 'free' : 'busy';
            return (
              <div className="agent-row" key={a._id}>
                <span className="avatar">{a.name.slice(0, 1)}</span>
                <div>
                  <div className="who-name">{a.name}</div>
                  <div className="muted small">{!a.active ? 'Disabled' : a.available ? 'Available' : 'On delivery'}</div>
                </div>
                <span className={`dot-status ${state}`} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title pad" style={{ paddingBottom: 0 }}>
            <h3>Recent orders</h3>
            <Link className="small" to="/admin/orders">
              View all
            </Link>
          </div>
          <div className="table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 6).map((o) => (
                  <tr key={o._id}>
                    <td data-label="Order">
                      <Link to={`/orders/${o._id}`}>{o.orderId}</Link>
                    </td>
                    <td data-label="Customer">{o.customer?.name}</td>
                    <td data-label="Status">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="small" data-label="Placed">{fmt(o.createdAt)}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card pad">
          <h3>Agent performance</h3>
          {r.agents.length === 0 ? (
            <p className="muted">No completed deliveries yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={r.agents}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                <Tooltip />
                <Legend />
                <Bar dataKey="delivered" fill="#0d9488" radius={[6, 6, 0, 0]} />
                <Bar dataKey="onTimeRate" name="on-time %" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="avgMinutes" name="avg min" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );
}
