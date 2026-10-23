import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('socket.io-client', () => ({ io: () => ({ on() {}, off() {}, emit() {}, disconnect() {} }) }));
vi.mock('../api.js', () => ({
  API_URL: '',
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  errMsg: (e) => e?.response?.data?.message || e?.message || 'Something went wrong',
}));

const { api } = await import('../api.js');
const { AuthProvider, useAuth } = await import('../auth.jsx');
const { default: UserOrders } = await import('./UserOrders.jsx');
const { default: AdminUsers } = await import('./AdminUsers.jsx');
const { LoadError } = await import('../components/ui.jsx');

const ME = { id: '1', name: 'Demo Customer', email: 'user@demo.com', role: 'user' };
const WhenReady = ({ children }) => (useAuth().user ? children : null);
const mount = (ui) =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <WhenReady>{ui}</WhenReady>
      </AuthProvider>
    </MemoryRouter>
  );

let ordersCall;
beforeEach(() => {
  localStorage.setItem('token', 'tok');
  vi.resetAllMocks();
  ordersCall = vi.fn();
  api.get.mockImplementation((url) => {
    if (url === '/auth/me') return Promise.resolve({ data: { user: ME } });
    if (url === '/orders') return ordersCall();
    if (url === '/admin/users') return ordersCall();
    return Promise.resolve({ data: {} });
  });
});
afterEach(cleanup);

describe('LoadError', () => {
  test('shows the message and calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<LoadError message="Cannot reach the server." onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('Cannot reach the server.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('pages that fail to load', () => {
  test('My Orders shows an error with retry instead of loading forever, then recovers', async () => {
    ordersCall.mockRejectedValueOnce({ request: {}, message: 'Network Error' });
    mount(<UserOrders />);

    expect(await screen.findByText("We couldn't load this page")).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();

    ordersCall.mockResolvedValue({ data: { orders: [] } });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'My Orders' })).toBeTruthy();
    expect(screen.queryByText("We couldn't load this page")).toBeNull();
  });

  test('shows the server message when the API answers with an error', async () => {
    ordersCall.mockRejectedValue({ response: { data: { message: 'Server error' } } });
    mount(<UserOrders />);
    expect(await screen.findByText('Server error')).toBeTruthy();
  });

  test('the Users page handles failure the same way', async () => {
    ordersCall.mockRejectedValue(new Error('Network Error'));
    mount(<AdminUsers />);
    expect(await screen.findByText("We couldn't load this page")).toBeTruthy();
  });
});
