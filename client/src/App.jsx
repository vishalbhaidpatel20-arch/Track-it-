import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import UserOrders from './pages/UserOrders.jsx';
import NewOrder from './pages/NewOrder.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import AgentDeliveries from './pages/AgentDeliveries.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminOrders from './pages/AdminOrders.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminLive from './pages/AdminLive.jsx';

const HOME = { user: '/orders', agent: '/deliveries', admin: '/admin' };

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME[user.role]} replace />;
  return children;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? HOME[user.role] : '/login'} replace />;
}

const page = (roles, el) => (
  <Protected roles={roles}>
    <Layout>{el}</Layout>
  </Protected>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/orders" element={page(['user'], <UserOrders />)} />
      <Route path="/orders/new" element={page(['user'], <NewOrder />)} />
      <Route path="/orders/:id" element={page(['user', 'agent', 'admin'], <OrderDetail />)} />

      <Route path="/deliveries" element={page(['agent'], <AgentDeliveries />)} />

      <Route path="/admin" element={page(['admin'], <AdminDashboard />)} />
      <Route path="/admin/orders" element={page(['admin'], <AdminOrders />)} />
      <Route path="/admin/live" element={page(['admin'], <AdminLive />)} />
      <Route path="/admin/users" element={page(['admin'], <AdminUsers />)} />

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
