import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import MapView, { TILES } from '../components/MapView.jsx';
import { fmtEta, StatusBadge, useLiveReload } from '../components/ui.jsx';

const FILTERS = ['All', 'Placed', 'Picked-up', 'In-Transit'];
const MAX_TRAIL = 40;

const km = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

const ago = (t, now) => {
  if (!t) return 'no signal yet';
  const s = Math.max(0, Math.round((now - t) / 1000));
  return s < 5 ? 'just now' : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : 'over 1h ago';
};

const Stat = ({ icon, label, value, tone }) => (
  <div className={`live-stat tone-bg-${tone}`}>
    <span className={`kpi-icon tone-${tone}`}>
      <Icon name={icon} />
    </span>
    <div>
      <div className="live-stat-value">{value}</div>
      <div className="muted small">{label}</div>
    </div>
  </div>
);

export default function AdminLive() {
  const { socket } = useAuth();
  const [orders, setOrders] = useState(null);
  const [pos, setPos] = useState({}); // agentId -> [lat, lng]
  const [seen, setSeen] = useState({}); // agentId -> timestamp of last position
  const [trails, setTrails] = useState({}); // agentId -> [[lat, lng], ...]
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [focus, setFocus] = useState(null);
  const [tile, setTile] = useState('light');
  const [showTrails, setShowTrails] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [full, setFull] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(
    () =>
      api.get('/admin/live').then((r) => {
        setOrders(r.data.orders);
        setPos((prev) => {
          const next = { ...prev };
          for (const o of r.data.orders) {
            const l = o.agent?.currentLocation;
            if (l?.lat != null && !next[o.agent._id]) next[o.agent._id] = [l.lat, l.lng];
          }
          return next;
        });
        setSeen((prev) => {
          const next = { ...prev };
          for (const o of r.data.orders) {
            const l = o.agent?.currentLocation;
            if (l?.updatedAt && !next[o.agent._id]) next[o.agent._id] = new Date(l.updatedAt).getTime();
          }
          return next;
        });
      }),
    []
  );
  useEffect(() => {
    load();
  }, [load]);
  useLiveReload(load);

  useEffect(() => {
    if (!socket) return;
    const onLoc = (p) => {
      setPos((prev) => ({ ...prev, [p.agentId]: [p.lat, p.lng] }));
      setSeen((prev) => ({ ...prev, [p.agentId]: Date.now() }));
      setTrails((prev) => ({ ...prev, [p.agentId]: [...(prev[p.agentId] || []), [p.lat, p.lng]].slice(-MAX_TRAIL) }));
    };
    socket.on('agent:location', onLoc);
    return () => socket.off('agent:location', onLoc);
  }, [socket]);

  // Re-render every 5s so "last seen" labels stay fresh
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // Close fullscreen with Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visible = useMemo(() => {
    if (!orders) return [];
    const q = query.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (filter === 'All' || o.status === filter) &&
        (!q || [o.orderId, o.agent?.name, o.customer?.name, o.drop.address, o.pickup.address].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [orders, filter, query]);

  if (!orders) return <p className="muted">Loading…</p>;

  const count = (s) => orders.filter((o) => o.status === s).length;
  const onlineAgents = new Set(orders.filter((o) => seen[o.agent._id] && now - seen[o.agent._id] < 2 * 60 * 1000).map((o) => o.agent._id)).size;
  const sel = orders.find((o) => o._id === selected);

  const stopOf = (o) => (o.status === 'Placed' ? o.pickup : o.drop);
  const etaMin = (o) => {
    const p = pos[o.agent._id];
    return p ? Math.max(1, Math.round((km(p, [stopOf(o).lat, stopOf(o).lng]) / 25) * 60)) : null;
  };

  const select = (o) => {
    setSelected(o._id);
    const p = pos[o.agent._id] || [o.pickup.lat, o.pickup.lng];
    setFocus({ key: o._id + Date.now(), pos: p });
  };

  // ----- map layers -----
  const agentIds = [...new Set(visible.map((o) => o.agent._id))].filter((id) => pos[id]);
  const markers = [
    ...agentIds.map((id) => {
      const o = visible.find((x) => x.agent._id === id);
      const fresh = seen[id] && now - seen[id] < 30000;
      return {
        id: 'a' + id,
        pos: pos[id],
        icon: fresh ? 'agentLive' : 'agent',
        label: `${o.agent.name} · updated ${ago(seen[id], now)}`,
        onClick: () => setSelected(o._id),
      };
    }),
    ...visible.flatMap((o) => {
      const isSel = o._id === selected;
      const next = stopOf(o);
      const list = [{ id: 'n' + o._id, pos: [next.lat, next.lng], icon: o.status === 'Placed' ? 'pickup' : 'drop', label: `${o.orderId} · ${o.status === 'Placed' ? 'pickup' : 'drop'}: ${next.address}`, onClick: () => setSelected(o._id) }];
      if (isSel) {
        const other = o.status === 'Placed' ? o.drop : o.pickup;
        list.push({ id: 'o' + o._id, pos: [other.lat, other.lng], icon: o.status === 'Placed' ? 'drop' : 'pickup', label: other.address });
      }
      return list;
    }),
  ];

  const lines = [
    ...(showRoutes
      ? visible.map((o) => {
          const isSel = o._id === selected;
          const from = pos[o.agent._id] || [o.pickup.lat, o.pickup.lng];
          const to = [stopOf(o).lat, stopOf(o).lng];
          return { id: 'r' + o._id, positions: [from, to], dashed: !isSel, color: isSel ? '#0d9488' : '#94a3b8', weight: isSel ? 4 : 2.5 };
        })
      : []),
    ...(showTrails
      ? agentIds.filter((id) => (trails[id] || []).length > 1).map((id) => ({ id: 't' + id, positions: trails[id], color: '#f97316', weight: 4, opacity: 0.75 }))
      : []),
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Live deliveries</h2>
          <p className="muted small">Real-time positions of your agents · updates as they move</p>
        </div>
        <span className="live-badge">
          <span className="pulse" /> Live
        </span>
      </div>

      <div className="live-stats">
        <Stat icon="truck" tone="orange" label="In progress" value={orders.length} />
        <Stat icon="box" tone="blue" label="Awaiting pickup" value={count('Placed')} />
        <Stat icon="map" tone="violet" label="In transit" value={count('Picked-up') + count('In-Transit')} />
        <Stat icon="pin" tone="green" label="Agents reporting" value={onlineAgents} />
      </div>

      <div className="live-layout">
        <div className={`card map-card ${full ? 'map-full' : ''}`}>
          <div className="map-toolbar">
            <div className="seg">
              {Object.entries(TILES).map(([k, t]) => (
                <button key={k} className={tile === k ? 'on' : ''} onClick={() => setTile(k)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="row">
              <label className="chk">
                <input type="checkbox" checked={showRoutes} onChange={(e) => setShowRoutes(e.target.checked)} /> Routes
              </label>
              <label className="chk">
                <input type="checkbox" checked={showTrails} onChange={(e) => setShowTrails(e.target.checked)} /> Trails
              </label>
              <button className="btn small" onClick={() => setFitKey((k) => k + 1)}>
                Fit all
              </button>
              <button className="btn small" onClick={() => setFull(!full)}>
                {full ? 'Exit full screen' : 'Full screen'}
              </button>
            </div>
          </div>

          <div className="map-body">
            <MapView markers={markers} lines={lines} fit fitKey={`${fitKey}-${filter}-${orders.length}`} focus={focus} tile={tile} height="100%" />
            <div className="map-legend">
              <span><i style={{ background: '#f97316' }} />Agent</span>
              <span><i style={{ background: '#1e3a8a' }} />Pickup</span>
              <span><i style={{ background: '#16a34a' }} />Drop</span>
            </div>
            {orders.length === 0 && <div className="map-empty">No active deliveries right now.<br />Assign an order to an agent to see it here.</div>}
          </div>
        </div>

        <div className="card live-panel">
          <div className="live-panel-head">
            <h3>Deliveries ({visible.length})</h3>
            <input className="search" placeholder="Search order, agent, customer…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="chips">
              {FILTERS.map((f) => (
                <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                  {f}
                  <b>{f === 'All' ? orders.length : count(f)}</b>
                </button>
              ))}
            </div>
          </div>

          <div className="live-list">
            {visible.length === 0 && <p className="muted pad">No deliveries match.</p>}
            {visible.map((o) => {
              const eta = etaMin(o);
              const fresh = seen[o.agent._id] && now - seen[o.agent._id] < 30000;
              return (
                <button key={o._id} className={`live-item ${o._id === selected ? 'sel' : ''}`} onClick={() => select(o)}>
                  <div className="between">
                    <strong>{o.orderId}</strong>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="li-agent">
                    <span className="avatar">{o.agent.name.slice(0, 1)}</span>
                    <div>
                      <div className="who-name">{o.agent.name}</div>
                      <div className="small muted">
                        <span className={`dot-status inline ${fresh ? 'free' : pos[o.agent._id] ? 'busy' : 'off'}`} />
                        {ago(seen[o.agent._id], now)}
                      </div>
                    </div>
                    {fmtEta(eta) && <span className="eta">~{fmtEta(eta)}</span>}
                  </div>
                  <div className="li-route small">
                    <span>{o.pickup.address}</span>
                    <span className="arrow">↓</span>
                    <span>{o.drop.address}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {sel && (
            <div className="live-selected">
              <div className="between">
                <strong>{sel.orderId}</strong>
                <Link to={`/orders/${sel._id}`}>Open details →</Link>
              </div>
              <div className="small muted">
                Customer: {sel.customer?.name} · {sel.distanceKm} km · next stop: {stopOf(sel).address}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
