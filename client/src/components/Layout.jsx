import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Logo, Wordmark } from './AuthShell.jsx';
import Footer from './Footer.jsx';
import Icon from './Icon.jsx';

const LINKS = {
  user: [
    ['/orders', 'My Orders', 'box'],
    ['/orders/new', 'New Order', 'plus'],
  ],
  agent: [['/deliveries', 'My Deliveries', 'truck']],
  admin: [
    ['/admin', 'Dashboard', 'grid'],
    ['/admin/orders', 'Orders', 'box'],
    ['/admin/live', 'Live Map', 'map'],
    ['/admin/users', 'Users', 'users'],
  ],
};

function Bell() {
  const { socket } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get('/notifications').then((r) => setItems(r.data.notifications));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onNotification = (n) => {
      setItems((prev) => [n, ...prev]);
      setToast(n);
      setTimeout(() => setToast(null), 4000);
    };
    socket.on('notification', onNotification);
    return () => socket.off('notification', onNotification);
  }, [socket]);

  const unread = items.filter((n) => !n.read).length;
  const toggle = () => {
    if (!open && unread) api.patch('/notifications/read-all').then(() => setItems((p) => p.map((n) => ({ ...n, read: true }))));
    setOpen(!open);
  };

  return (
    <div className="bell">
      <button className="icon-circle" onClick={toggle} aria-label="Notifications">
        <Icon name="bell" />
        {unread > 0 && <span className="badge-count">{unread}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div className="dropdown-head">Notifications</div>
          {items.length === 0 && <p className="muted pad">No notifications</p>}
          {items.slice(0, 15).map((n) => (
            <div
              key={n._id}
              className={`notif ${n.read ? '' : 'unread'}`}
              onClick={() => {
                setOpen(false);
                if (n.order) navigate(`/orders/${n.order}`);
              }}
            >
              <strong>{n.title}</strong>
              <div>{n.message}</div>
              <small className="muted">{new Date(n.createdAt).toLocaleString()}</small>
            </div>
          ))}
        </div>
      )}
      {toast && (
        <div className="toast">
          <strong>{toast.title}</strong>
          <div>{toast.message}</div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = LINKS[user.role];

  return (
    <div className="app">
      <header className="topnav">
        <div className="topnav-inner">
          <div className="side-brand">
            <Logo size={34} />
            <Wordmark />
          </div>

          <nav className="topnav-links">
            {links.map(([to, label, icon]) => (
              <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon name={icon} size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="topnav-right">
            <Bell />
            <div className="user-chip">
              <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              <div className="user-chip-info">
                <div className="who-name">{user.name}</div>
                <div className="who-role">{user.role}</div>
              </div>
            </div>
            <button
              className="icon-circle dark"
              title="Log out"
              aria-label="Log out"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="container">{children}</main>
      <Footer />

      <nav className="bottom-nav" aria-label="Primary">
        {links.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={icon} size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
