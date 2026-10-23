import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Logo, Wordmark } from './AuthShell.jsx';

const LINKS = {
  user: [['/orders', 'My Orders'], ['/orders/new', 'New Order']],
  agent: [['/deliveries', 'My Deliveries']],
  admin: [['/admin', 'Dashboard'], ['/admin/orders', 'Orders'], ['/admin/live', 'Live Map'], ['/admin/users', 'Users']],
};

export default function Footer() {
  const { user } = useAuth();
  return (
    <footer className="footer">
      <div className="footer-compact">
        <Logo size={20} />
        <span>© {new Date().getFullYear()} TrackIt</span>
      </div>
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="brand">
            <Logo size={28} />
            <Wordmark />
          </div>
          <p className="muted small">Real-time delivery tracking and order management for modern logistics teams.</p>
        </div>
        <div>
          <h4>Quick links</h4>
          {LINKS[user.role].map(([to, label]) => (
            <Link key={to} to={to}>
              {label}
            </Link>
          ))}
        </div>
        <div>
          <h4>Platform</h4>
          <span className="muted small">Live GPS tracking</span>
          <span className="muted small">Instant notifications</span>
          <span className="muted small">Role-based access</span>
        </div>
        <div>
          <h4>System</h4>
          <span className="small">
            <span className="pulse inline" /> All systems operational
          </span>
          <span className="muted small">Maps © OpenStreetMap contributors</span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} TrackIt. All rights reserved.</span>
        <span>Built with React, Node.js, MongoDB &amp; Socket.IO</span>
      </div>
    </footer>
  );
}
