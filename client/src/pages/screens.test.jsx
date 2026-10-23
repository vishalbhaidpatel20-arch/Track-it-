import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('socket.io-client', () => ({ io: () => ({ on() {}, off() {}, emit() {}, disconnect() {} }) }));
vi.mock('../api.js', () => ({
  API_URL: '',
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  errMsg: (e) => e?.response?.data?.message || e?.message || 'Something went wrong',
}));

const { api } = await import('../api.js');
const { AuthProvider, useAuth } = await import('../auth.jsx');
const { default: Login } = await import('./Login.jsx');
const { default: Layout } = await import('../components/Layout.jsx');
const { default: App } = await import('../App.jsx');

const USERS = {
  user: { id: '1', name: 'Demo Customer', email: 'user@demo.com', role: 'user' },
  agent: { id: '2', name: 'Ravi Agent', email: 'agent1@demo.com', role: 'agent' },
  admin: { id: '3', name: 'Admin', email: 'admin@demo.com', role: 'admin' },
};

// The real app renders the layout only after the signed-in user has loaded; mirror that here.
const WhenReady = ({ children }) => (useAuth().user ? children : null);

const mount = (ui, path = '/login') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/notifications') return Promise.resolve({ data: { notifications: [] } });
    if (url === '/orders') return Promise.resolve({ data: { orders: [] } });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
});
afterEach(cleanup);

describe('Login screen', () => {
  test('demo buttons fill in the credentials', async () => {
    mount(<Login />);
    await userEvent.click(screen.getByText('Admin'));
    expect(screen.getByLabelText('Email').value).toBe('admin@demo.com');
    expect(screen.getByLabelText('Password').value).toBe('password123');
  });

  test('shows the server message when sign-in fails', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } });
    mount(<Login />);
    await userEvent.type(screen.getByLabelText('Email'), 'who@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
    expect(localStorage.getItem('token')).toBeNull();
  });

  test('stores the token and leaves the login page on success', async () => {
    api.post.mockResolvedValue({ data: { token: 'tok123', user: USERS.user } });
    mount(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/orders" element={<p>orders page</p>} />
      </Routes>
    );
    await userEvent.type(screen.getByLabelText('Email'), 'user@demo.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('orders page')).toBeTruthy();
    expect(localStorage.getItem('token')).toBe('tok123');
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'user@demo.com', password: 'password123' });
  });
});

describe('Navigation per role', () => {
  const signedIn = (role) => {
    localStorage.setItem('token', 'tok');
    api.get.mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: { user: USERS[role] } });
      if (url === '/notifications') return Promise.resolve({ data: { notifications: [] } });
      return Promise.resolve({ data: { orders: [] } });
    });
  };
  const mountLayout = (path) =>
    mount(
      <WhenReady>
        <Layout>page</Layout>
      </WhenReady>,
      path
    );
  const labels = () => screen.getAllByRole('link').map((a) => a.textContent.trim());

  test('customers see their own links only', async () => {
    signedIn('user');
    mountLayout('/orders');
    await screen.findAllByText('My Orders');
    expect(labels()).toEqual(expect.arrayContaining(['My Orders', 'New Order']));
    expect(labels()).not.toContain('Users');
    expect(labels()).not.toContain('My Deliveries');
  });

  test('agents see deliveries', async () => {
    signedIn('agent');
    mountLayout('/deliveries');
    await screen.findAllByText('My Deliveries');
    expect(labels()).not.toContain('New Order');
  });

  test('admins see the management links', async () => {
    signedIn('admin');
    mountLayout('/admin');
    await screen.findAllByText('Dashboard');
    expect(labels()).toEqual(expect.arrayContaining(['Dashboard', 'Orders', 'Live Map', 'Users']));
  });
});

describe('Route protection', () => {
  const open = (role, path) => {
    localStorage.setItem('token', 'tok');
    api.get.mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: { user: USERS[role] } });
      if (url === '/notifications') return Promise.resolve({ data: { notifications: [] } });
      if (url === '/orders') return Promise.resolve({ data: { orders: [] } });
      return Promise.resolve({ data: {} });
    });
    return mount(<App />, path);
  };

  test('visitors are sent to the login page', async () => {
    mount(<App />, '/admin');
    expect(await screen.findByText('Welcome back')).toBeTruthy();
  });

  test('a customer opening an admin URL lands on their own orders page', async () => {
    open('user', '/admin');
    expect(await screen.findByText('My Orders', { selector: 'h2' })).toBeTruthy();
    expect(screen.queryByText('Live deliveries')).toBeNull();
  });

  test('an agent opening the customer page lands on deliveries', async () => {
    open('agent', '/orders/new');
    await waitFor(() => expect(screen.getAllByText('My Deliveries').length).toBeGreaterThan(0));
  });
});
