import { Component } from 'react';
import { captureError } from '../monitoring.js';
import { Logo } from './AuthShell.jsx';

/** Catches render errors anywhere below it: reports them and shows a friendly screen instead of a blank page. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    captureError(error, { componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="auth-wrap crash" role="alert">
        <div className="card pad crash-card">
          <Logo size={44} />
          <h2>Something went wrong</h2>
          <p className="muted">
            An unexpected error occurred. It has been reported and we are looking into it. Reloading usually fixes it.
          </p>
          <div className="row">
            <button className="btn primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a className="btn" href="/">
              Go to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
