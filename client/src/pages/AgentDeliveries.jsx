import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import MapView from '../components/MapView.jsx';
import { Alert, CallButton, mapsUrl, StatusBadge, useLiveReload } from '../components/ui.jsx';

const NEXT = { Placed: 'Picked-up', 'Picked-up': 'In-Transit', 'In-Transit': 'Delivered' };
const OPEN = ['Placed', 'Picked-up', 'In-Transit'];

export default function AgentDeliveries() {
  const { socket } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [mode, setMode] = useState('off'); // off | gps | sim
  const [pos, setPos] = useState(null);
  const posRef = useRef(null);
  const ordersRef = useRef([]);

  const load = useCallback(
    () =>
      api.get('/orders').then((r) => {
        setOrders(r.data.orders);
        ordersRef.current = r.data.orders;
      }),
    []
  );
  useEffect(() => {
    load();
  }, [load]);
  useLiveReload(load);

  const emit = useCallback(
    (lat, lng) => {
      posRef.current = { lat, lng };
      setPos([lat, lng]);
      socket?.emit('location:update', { lat, lng });
    },
    [socket]
  );

  // Real GPS sharing
  useEffect(() => {
    if (mode !== 'gps') return;
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      setMode('off');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => emit(p.coords.latitude, p.coords.longitude),
      (e) => {
        setError(`GPS error: ${e.message}. Allow location access in your browser settings.`);
        setMode('off');
      },
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [mode, emit]);

  // Simulated movement (demo without a GPS device): walk toward the next stop of the first open order.
  useEffect(() => {
    if (mode !== 'sim') return;
    const tick = () => {
      const open = ordersRef.current.find((o) => OPEN.includes(o.status));
      if (!open) return;
      const dest = open.status === 'Placed' ? open.pickup : open.drop;
      const cur = posRef.current || { lat: open.pickup.lat + 0.02, lng: open.pickup.lng + 0.02 };
      const step = 0.15;
      const jitter = () => (Math.random() - 0.5) * 0.0004;
      emit(cur.lat + (dest.lat - cur.lat) * step + jitter(), cur.lng + (dest.lng - cur.lng) * step + jitter());
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [mode, emit]);

  const advance = async (o) => {
    setError('');
    setBusyId(o._id);
    try {
      await api.patch(`/orders/${o._id}/status`, { status: NEXT[o.status] });
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  };

  if (!orders) return <p className="muted">Loading…</p>;
  const open = orders.filter((o) => OPEN.includes(o.status));
  const done = orders.filter((o) => !OPEN.includes(o.status));
  const sharing = mode !== 'off';

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My Deliveries</h2>
          <p className="muted small">
            {open.length ? `${open.length} active ${open.length > 1 ? 'deliveries' : 'delivery'}` : 'No active deliveries right now'}
          </p>
        </div>
      </div>
      <Alert>{error}</Alert>

      <section className={`share-card ${sharing ? 'on' : ''}`}>
        <div className="share-info">
          <span className="share-icon">
            <Icon name="crosshair" size={22} />
          </span>
          <div>
            <strong>{sharing ? 'Sharing your live location' : 'Location sharing is off'}</strong>
            <div className="small">
              {sharing
                ? pos
                  ? `${mode === 'gps' ? 'GPS' : 'Simulated'} · ${pos[0].toFixed(4)}, ${pos[1].toFixed(4)}`
                  : 'Getting your position…'
                : 'Turn it on so customers can track you'}
            </div>
          </div>
          {sharing && <span className="pulse" />}
        </div>
        <div className="seg seg-3">
          {[['off', 'Off'], ['gps', 'GPS'], ['sim', 'Simulate']].map(([m, label]) => (
            <button type="button" key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {pos && (
        <div className="card pad agent-map">
          <MapView
            height={240}
            markers={[
              { id: 'me', pos, icon: 'agentLive', label: 'You' },
              ...open.flatMap((o) => [
                { id: o._id + 'p', pos: [o.pickup.lat, o.pickup.lng], icon: 'pickup', label: o.pickup.address },
                { id: o._id + 'd', pos: [o.drop.lat, o.drop.lng], icon: 'drop', label: o.drop.address },
              ]),
            ]}
          />
        </div>
      )}

      <h3 className="section-h">Active ({open.length})</h3>
      {open.length === 0 && <p className="muted card pad">Nothing assigned right now. New assignments appear here instantly.</p>}
      <div className="cards">
        {open.map((o) => {
          const stop = o.status === 'Placed' ? o.pickup : o.drop;
          return (
            <article key={o._id} className="card pad stack delivery-card">
              <div className="between">
                <Link to={`/orders/${o._id}`}>
                  <strong>{o.orderId}</strong>
                </Link>
                <StatusBadge status={o.status} />
              </div>
              <div className="small">📦 {o.packageDescription}</div>
              <div className="oc-route">
                <div className={o.status === 'Placed' ? 'next-stop' : ''}>
                  <i className="rdot pk" />
                  {o.pickup.address}
                </div>
                <div className={o.status !== 'Placed' ? 'next-stop' : ''}>
                  <i className="rdot dr" />
                  {o.drop.address}
                </div>
              </div>
              <div className="small muted">
                Customer: {o.customer?.name} {o.customer?.phone && `· ${o.customer.phone}`}
              </div>
              <div className="action-row">
                <a className="btn" href={mapsUrl(stop)} target="_blank" rel="noreferrer">
                  <Icon name="nav" size={16} /> Navigate
                </a>
                <CallButton phone={o.customer?.phone} label="Call customer" />
              </div>
              <button className="btn primary big" disabled={busyId === o._id} onClick={() => advance(o)}>
                {busyId === o._id ? 'Updating…' : `Mark ${NEXT[o.status]}`}
              </button>
            </article>
          );
        })}
      </div>

      {done.length > 0 && (
        <>
          <h3 className="section-h">Completed ({done.length})</h3>
          <div className="mini-list card">
            {done.map((o) => (
              <Link key={o._id} to={`/orders/${o._id}`} className="mini-item">
                <div>
                  <strong>{o.orderId}</strong>
                  <div className="small muted">{o.drop.address}</div>
                </div>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
