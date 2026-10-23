import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary.jsx';
import { setReporter } from '../monitoring.js';

const Bomb = ({ explode }) => {
  if (explode) throw new Error('render exploded');
  return <p>all good</p>;
};

let reported;
beforeEach(() => {
  reported = [];
  setReporter((err, ctx) => reported.push({ err, ctx }));
  vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs caught render errors
});
afterEach(() => {
  cleanup();
  setReporter(null);
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  test('renders children when nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeTruthy();
    expect(reported).toHaveLength(0);
  });

  test('shows a friendly recovery screen instead of a blank page when a child crashes', () => {
    render(
      <ErrorBoundary>
        <Bomb explode />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Reload page')).toBeTruthy();
    expect(screen.getByText('Go to home').getAttribute('href')).toBe('/');
    expect(screen.queryByText('render exploded')).toBeNull(); // internals are not shown to users
  });

  test('reports the crash with the component stack', () => {
    render(
      <ErrorBoundary>
        <Bomb explode />
      </ErrorBoundary>
    );
    expect(reported).toHaveLength(1);
    expect(reported[0].err.message).toBe('render exploded');
    expect(reported[0].ctx.componentStack).toContain('Bomb');
  });

  test('only the crashing subtree is replaced when boundaries are nested', () => {
    render(
      <div>
        <p>sidebar stays</p>
        <ErrorBoundary>
          <Bomb explode />
        </ErrorBoundary>
      </div>
    );
    expect(screen.getByText('sidebar stays')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
