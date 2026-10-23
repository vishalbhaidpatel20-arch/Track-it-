import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api.js';
import { Alert, LoadError, OrdersTable, useLiveReload } from '../components/ui.jsx';

const FILTERS = ['All', 'Placed', 'Picked-up', 'In-Transit', 'Delivered', 'Cancelled'];

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [agents, setAgents] = useState([]);
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState('');

  const [loadError, setLoadError] = useState('');
  const load = useCallback(
    () =>
      api
        .get('/orders')
        .then((r) => {
          setOrders(r.data.orders);
          setLoadError('');
        })
        .catch((e) => setLoadError(errMsg(e))),
    []
  );
  useEffect(() => {
    load();
    api
      .get('/admin/users?role=agent')
      .then((r) => setAgents(r.data.users.filter((a) => a.active)))
      .catch(() => {}); // the order list shows its own error
  }, [load]);
  useLiveReload(load);

  const assign = async (order, agentId) => {
    if (!agentId) return;
    setError('');
    try {
      await api.patch(`/orders/${order._id}/assign`, { agentId });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  if (!orders) return loadError ? <LoadError message={loadError} onRetry={load} /> : <p className="muted">Loading…</p>;
  const shown = filter === 'All' ? orders : orders.filter((o) => o.status === filter);

  return (
    <>
      <h2>Orders</h2>
      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f} ({f === 'All' ? orders.length : orders.filter((o) => o.status === f).length})
          </button>
        ))}
      </div>
      <Alert>{error}</Alert>
      <OrdersTable
        orders={shown}
        showCustomer
        showAgent
        actions={(o) =>
          o.status === 'Placed' && (
            <select value="" onChange={(e) => assign(o, e.target.value)}>
              <option value="">{o.agent ? 'Reassign…' : 'Assign…'}</option>
              {agents.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} {a.available ? '' : '(busy)'}
                </option>
              ))}
            </select>
          )
        }
      />
    </>
  );
}
