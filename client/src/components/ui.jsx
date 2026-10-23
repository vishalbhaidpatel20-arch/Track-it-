import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Icon from './Icon.jsx';

export const STATUS_STEPS = ['Placed', 'Picked-up', 'In-Transit', 'Delivered'];

export const StatusBadge = ({ status }) => (
  <span className={`status s-${status.toLowerCase()}`}>{status}</span>
);

export const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

/** Minutes -> "12 min" / "1h 5m". Returns null when the figure is not meaningful (agent far away / unknown). */
export const fmtEta = (min) => {
  if (min == null || min > 24 * 60) return null;
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
};

export const mapsUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;

export const Alert = ({ children }) => (children ? <div className="alert">{children}</div> : null);

/** One-tap call button; renders nothing without a phone number. */
export const CallButton = ({ phone, label = 'Call' }) =>
  phone ? (
    <a className="btn small call-btn" href={`tel:${phone}`}>
      <Icon name="phone" size={16} /> {label}
    </a>
  ) : null;

/** Calls `reload` whenever the server pushes the given socket event(s). */
export function useLiveReload(reload, events = ['order:status', 'order:new']) {
  const { socket } = useAuth();
  useEffect(() => {
    if (!socket) return;
    events.forEach((e) => socket.on(e, reload));
    return () => events.forEach((e) => socket.off(e, reload));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);
}

/** Desktop: table. Phones: tappable cards (CSS shows one or the other). */
export function OrdersTable({ orders, showCustomer, showAgent, actions }) {
  if (!orders.length) return <p className="muted card pad">No orders yet.</p>;
  return (
    <>
      <div className="card table-wrap orders-desktop">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              {showCustomer && <th>Customer</th>}
              <th>Route</th>
              {showAgent && <th>Agent</th>}
              <th>Status</th>
              <th>Placed</th>
              {actions && <th></th>}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id}>
                <td>
                  <Link to={`/orders/${o._id}`}>{o.orderId}</Link>
                  <div className="muted small">{o.packageDescription}</div>
                </td>
                {showCustomer && <td>{o.customer?.name}</td>}
                <td className="small">
                  {o.pickup.address}
                  <br />→ {o.drop.address}
                </td>
                {showAgent && <td>{o.agent?.name || <span className="muted">Unassigned</span>}</td>}
                <td>
                  <StatusBadge status={o.status} />
                </td>
                <td className="small">{fmt(o.createdAt)}</td>
                {actions && <td>{actions(o)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="order-cards">
        {orders.map((o) => (
          <article key={o._id} className="order-card">
            <div className="oc-head">
              <Link to={`/orders/${o._id}`} className="oc-id">
                {o.orderId}
              </Link>
              <StatusBadge status={o.status} />
            </div>
            <div className="oc-pkg">📦 {o.packageDescription}</div>
            <div className="oc-route">
              <div>
                <i className="rdot pk" />
                {o.pickup.address}
              </div>
              <div>
                <i className="rdot dr" />
                {o.drop.address}
              </div>
            </div>
            <div className="oc-meta">
              {showCustomer && <span>👤 {o.customer?.name}</span>}
              {showAgent && <span>🛵 {o.agent?.name || 'Unassigned'}</span>}
              <span>🕒 {new Date(o.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            {actions && actions(o) && <div className="oc-actions">{actions(o)}</div>}
            <Link to={`/orders/${o._id}`} className="oc-open">
              View details <span>›</span>
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
