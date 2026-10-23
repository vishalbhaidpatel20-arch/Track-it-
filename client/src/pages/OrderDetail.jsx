import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import MapView from '../components/MapView.jsx';
import { Alert, CallButton, fmt, fmtEta, mapsUrl, StatusBadge, STATUS_STEPS } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

const NEXT = { Placed: 'Picked-up', 'Picked-up': 'In-Transit', 'In-Transit': 'Delivered' };

function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function Stepper({ status }) {
  if (status === 'Cancelled') return <p className="alert">This order was cancelled.</p>;
  const idx = STATUS_STEPS.indexOf(status);
  return (
    <div className="stepper">
      {STATUS_STEPS.map((s, i) => (
        <div key={s} className={`step ${i <= idx ? 'done' : ''}`}>
          <span className="dot">{i < idx || status === 'Delivered' ? '✓' : i + 1}</span>
          {s}
        </div>
      ))}
    </div>
  );
}

function Rating({ order, onDone }) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    try {
      await api.post(`/orders/${order._id}/rate`, { rating, feedback: feedback || undefined });
      onDone();
    } catch (e) {
      setError(errMsg(e));
    }
  };
  return (
    <div className="card pad stack">
      <h3>Rate this delivery</h3>
      <Alert>{error}</Alert>
      <div className="stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>
            ★
          </button>
        ))}
      </div>
      <textarea rows={2} placeholder="Feedback (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      <button className="btn primary" onClick={submit}>
        Submit rating
      </button>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const { user, socket } = useAuth();
  const [data, setData] = useState(null);
  const [agentPos, setAgentPos] = useState(null);
  const [agents, setAgents] = useState([]);
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/orders/${id}`);
      setData(r.data);
      const loc = r.data.order.agent?.currentLocation;
      if (loc?.lat != null) setAgentPos([loc.lat, loc.lng]);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user.role === 'admin') api.get('/admin/users?role=agent').then((r) => setAgents(r.data.users));
  }, [user.role]);

  // Join this order's live room and react to pushed updates.
  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit('order:join', id);
    const onLocation = (p) => p.orderId === id && setAgentPos([p.lat, p.lng]);
    const onStatus = (p) => p.orderId === id && load();
    join();
    socket.on('connect', join);
    socket.on('location:update', onLocation);
    socket.on('order:status', onStatus);
    return () => {
      socket.emit('order:leave', id);
      socket.off('connect', join);
      socket.off('location:update', onLocation);
      socket.off('order:status', onStatus);
    };
  }, [socket, id, load]);

  const act = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  if (!data) return error ? <Alert>{error}</Alert> : <p className="muted">Loading…</p>;
  const { order, logs } = data;
  const live = ['Picked-up', 'In-Transit'].includes(order.status);
  const showAgent = agentPos && (live || (order.status === 'Placed' && user.role !== 'user'));

  const markers = [
    { id: 'p', pos: [order.pickup.lat, order.pickup.lng], icon: 'pickup', label: `Pickup: ${order.pickup.address}` },
    { id: 'd', pos: [order.drop.lat, order.drop.lng], icon: 'drop', label: `Drop: ${order.drop.address}` },
    showAgent && { id: 'a', pos: agentPos, icon: 'agent', label: order.agent?.name || 'Agent' },
  ].filter(Boolean);
  const lines = [{ id: 'route', positions: [markers[0].pos, markers[1].pos], dashed: true }];

  const target = order.status === 'Placed' ? order.pickup : order.drop;
  const etaMin = live && agentPos ? Math.max(1, Math.round((distanceKm({ lat: agentPos[0], lng: agentPos[1] }, target) / 25) * 60)) : null;
  const isMine = order.agent && order.agent._id === user.id;
  const canAdvance = NEXT[order.status] && order.agent && (user.role === 'admin' || (user.role === 'agent' && isMine));
  const canCancel = (user.role === 'user' && order.status === 'Placed') || (user.role === 'admin' && !['Delivered', 'Cancelled'].includes(order.status));

  return (
    <>
      <div className="page-head">
        <h2>
          {order.orderId} <StatusBadge status={order.status} />
        </h2>
        <div className="row">
          {canAdvance && (
            <button className="btn primary" onClick={() => act(() => api.patch(`/orders/${id}/status`, { status: NEXT[order.status] }))}>
              Mark {NEXT[order.status]}
            </button>
          )}
          {canCancel && (
            <button className="btn danger" onClick={() => act(() => api.patch(`/orders/${id}/cancel`))}>
              Cancel order
            </button>
          )}
        </div>
      </div>
      <Alert>{error}</Alert>
      <div className="card pad">
        <Stepper status={order.status} />
        {live && (
          <p className="live">
            <span className="pulse" /> Live tracking{fmtEta(etaMin) ? ` · about ${fmtEta(etaMin)} to ${order.status === 'Placed' ? 'pickup' : 'drop'}` : agentPos ? ' · agent is not near the route yet' : ' · waiting for agent location'}
          </p>
        )}
      </div>

      <div className="od-grid">
        <div className="card pad od-map">
          <MapView markers={markers} lines={lines} height={420} />
        </div>
        <div className="stack od-info">
          <div className="card pad stack small-text">
            <div><strong>Package:</strong> {order.packageDescription}</div>
            {order.notes && <div><strong>Notes:</strong> {order.notes}</div>}
            <div><strong>Pickup:</strong> {order.pickup.address}</div>
            <div><strong>Drop:</strong> {order.drop.address}</div>
            <div><strong>Distance:</strong> {order.distanceKm} km · <strong>Due by:</strong> {fmt(order.dueAt)}</div>
            {user.role !== 'user' && (
              <div className="contact-row">
                <div>
                  <strong>Customer:</strong> {order.customer.name}
                  {order.customer.phone && <div className="muted small">{order.customer.phone}</div>}
                </div>
                <CallButton phone={order.customer.phone} />
              </div>
            )}
            <div className="contact-row">
              <div>
                <strong>Agent:</strong> {order.agent ? order.agent.name : 'Not assigned yet'}
                {order.agent?.phone && <div className="muted small">{order.agent.phone}</div>}
              </div>
              {user.role !== 'agent' && <CallButton phone={order.agent?.phone} label="Call agent" />}
            </div>
            {user.role === 'agent' && live && (
              <a className="btn" href={mapsUrl(target)} target="_blank" rel="noreferrer">
                <Icon name="nav" size={16} /> Navigate to {order.status === 'Placed' ? 'pickup' : 'drop'}
              </a>
            )}
            {order.rating && <div><strong>Rating:</strong> {'★'.repeat(order.rating)} {order.feedback}</div>}
          </div>

          {user.role === 'admin' && order.status === 'Placed' && (
            <div className="card pad stack">
              <h3>{order.agent ? 'Reassign agent' : 'Assign agent'}</h3>
              <div className="row">
                <select value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Select agent…</option>
                  {agents.filter((a) => a.active).map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} {a.available ? '' : '(busy)'}
                    </option>
                  ))}
                </select>
                <button className="btn primary" disabled={!pick} onClick={() => act(() => api.patch(`/orders/${id}/assign`, { agentId: pick }))}>
                  Assign
                </button>
              </div>
            </div>
          )}

          {user.role === 'user' && order.status === 'Delivered' && !order.rating && <Rating order={order} onDone={load} />}

        </div>

        <div className="card pad od-time">
            <h3>Status history</h3>
            <ul className="timeline">
              {logs.map((l) => (
                <li key={l._id}>
                  <strong>{l.status}</strong> {l.note && <span>· {l.note}</span>}
                  <div className="muted small">
                    {fmt(l.createdAt)} {l.changedBy && `· ${l.changedBy.name}`}
                  </div>
                </li>
              ))}
            </ul>
        </div>
      </div>
    </>
  );
}
