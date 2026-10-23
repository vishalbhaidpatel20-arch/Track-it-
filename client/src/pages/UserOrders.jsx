import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { OrdersTable, useLiveReload } from '../components/ui.jsx';

export default function UserOrders() {
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState('active');

  const load = useCallback(() => api.get('/orders').then((r) => setOrders(r.data.orders)), []);
  useEffect(() => {
    load();
  }, [load]);
  useLiveReload(load);

  if (!orders) return <p className="muted">Loading…</p>;
  const isActive = (o) => !['Delivered', 'Cancelled'].includes(o.status);
  const shown = orders.filter((o) => (tab === 'active' ? isActive(o) : !isActive(o)));

  return (
    <>
      <div className="page-head">
        <h2>My Orders</h2>
        <Link className="btn primary" to="/orders/new">
          + New order
        </Link>
      </div>
      <div className="tabs">
        <button className={tab === 'active' ? 'on' : ''} onClick={() => setTab('active')}>
          Active ({orders.filter(isActive).length})
        </button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
          History ({orders.filter((o) => !isActive(o)).length})
        </button>
      </div>
      <OrdersTable orders={shown} showAgent />
    </>
  );
}
