import Icon from './Icon.jsx';

/** Brand mark: a location pin holding a parcel, above a dashed delivery route. */
export const Logo = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <defs>
      <linearGradient id="trackit-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#14b8a6" />
        <stop offset="1" stopColor="#0f766e" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="12" fill="url(#trackit-g)" />
    <path
      d="M20 6c-5.5 0-9.5 4.2-9.5 9.4 0 6.4 7.2 12.6 8.6 13.8a1.4 1.4 0 0 0 1.8 0c1.4-1.2 8.6-7.4 8.6-13.8C29.5 10.2 25.5 6 20 6Z"
      fill="#fff"
    />
    <path d="M20 11.2l3.4 1.9v3.8L20 18.8l-3.4-1.9v-3.8Z" fill="#0f766e" />
    <path d="M16.6 13.1 20 15l3.4-1.9M20 15v3.8" stroke="#fff" strokeWidth="1" strokeLinejoin="round" fill="none" />
    <path d="M7 34c5-3.2 21-3.2 26 0" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="0.1 3.6" fill="none" />
    <circle cx="33" cy="34" r="1.8" fill="#fff" />
  </svg>
);

export const Wordmark = () => (
  <span className="wordmark">
    Track<em>It</em>
  </span>
);

const FEATURES = [
  ['pin', 'Live GPS tracking', 'Watch your delivery move on the map in real time.'],
  ['bell', 'Instant updates', 'Status changes pushed the moment they happen.'],
  ['chart', 'Operations insights', 'On-time rate, durations and agent performance.'],
];

/** Split-screen layout shared by the login and register pages. */
export default function AuthShell({ children }) {
  return (
    <div className="auth-split">
      <aside className="auth-hero">
        <div className="hero-brand">
          <Logo size={44} />
          <Wordmark />
        </div>
        <h1>Every delivery, in real time.</h1>
        <p>Place orders, assign agents and follow every parcel from pickup to doorstep.</p>
        <ul>
          {FEATURES.map(([icon, title, text]) => (
            <li key={title}>
              <span className="f-icon">
                <Icon name={icon} />
              </span>
              <div>
                <strong>{title}</strong>
                <div>{text}</div>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <section className="auth-panel">{children}</section>
    </div>
  );
}
