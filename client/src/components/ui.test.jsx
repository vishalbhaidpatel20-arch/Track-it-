import { describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach } from 'vitest';
import { CallButton, fmt, fmtEta, mapsUrl, OrdersTable, StatusBadge } from './ui.jsx';

afterEach(cleanup);

const order = (over = {}) => ({
  _id: 'o1',
  orderId: 'ORD-ABC123',
  status: 'Placed',
  packageDescription: 'Laptop bag',
  pickup: { address: 'Karol Bagh', lat: 28.65, lng: 77.19 },
  drop: { address: 'India Gate', lat: 28.61, lng: 77.23 },
  customer: { name: 'Demo Customer' },
  agent: null,
  createdAt: '2026-01-01T10:00:00Z',
  ...over,
});

const renderTable = (props) =>
  render(
    <MemoryRouter>
      <OrdersTable {...props} />
    </MemoryRouter>
  );

describe('fmtEta', () => {
  test('formats minutes and hours', () => {
    expect(fmtEta(1)).toBe('1 min');
    expect(fmtEta(45)).toBe('45 min');
    expect(fmtEta(60)).toBe('1h 0m');
    expect(fmtEta(135)).toBe('2h 15m');
  });

  test('returns null for unknown or implausible values (agent far away)', () => {
    expect(fmtEta(null)).toBeNull();
    expect(fmtEta(undefined)).toBeNull();
    expect(fmtEta(24 * 60 + 1)).toBeNull();
    expect(fmtEta(2465)).toBeNull();
  });
});

describe('small helpers', () => {
  test('mapsUrl builds a driving-directions link', () => {
    const url = mapsUrl({ lat: 28.6129, lng: 77.2295 });
    expect(url).toContain('destination=28.6129,77.2295');
    expect(url).toContain('travelmode=driving');
  });

  test('fmt shows a dash for empty dates', () => {
    expect(fmt(null)).toBe('—');
    expect(fmt('2026-01-01T10:00:00Z')).not.toBe('—');
  });

  test('StatusBadge shows the status with a matching class', () => {
    render(<StatusBadge status="In-Transit" />);
    const badge = screen.getByText('In-Transit');
    expect(badge.className).toContain('s-in-transit');
  });

  test('CallButton renders a tel: link, or nothing without a number', () => {
    const { container, rerender } = render(<CallButton phone="9000000001" label="Call agent" />);
    expect(screen.getByText('Call agent').closest('a').getAttribute('href')).toBe('tel:9000000001');
    rerender(<CallButton phone={undefined} />);
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('OrdersTable', () => {
  test('shows an empty state', () => {
    renderTable({ orders: [] });
    expect(screen.getByText('No orders yet.')).toBeTruthy();
  });

  test('renders every order as a table row and as a mobile card, linking to details', () => {
    const { container } = renderTable({ orders: [order(), order({ _id: 'o2', orderId: 'ORD-XYZ789', status: 'Delivered' })], showCustomer: true, showAgent: true });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.querySelectorAll('.order-card')).toHaveLength(2);
    const links = screen.getAllByText('ORD-ABC123');
    expect(links.every((l) => l.closest('a').getAttribute('href') === '/orders/o1')).toBe(true);
  });

  test('shows the route, customer and "Unassigned" for orders without an agent', () => {
    const { container } = renderTable({ orders: [order()], showCustomer: true, showAgent: true });
    const card = within(container.querySelector('.order-card'));
    expect(card.getByText('Karol Bagh')).toBeTruthy();
    expect(card.getByText('India Gate')).toBeTruthy();
    expect(card.getByText(/Demo Customer/)).toBeTruthy();
    expect(card.getByText(/Unassigned/)).toBeTruthy();
  });

  test('shows the assigned agent name', () => {
    renderTable({ orders: [order({ agent: { _id: 'a1', name: 'Ravi Agent' }, status: 'Picked-up' })], showAgent: true });
    expect(screen.getAllByText(/Ravi Agent/).length).toBeGreaterThan(0);
  });

  test('renders row actions only when the callback returns something', () => {
    const actions = vi.fn((o) => (o.status === 'Placed' ? <button>Assign</button> : null));
    const { container } = renderTable({ orders: [order(), order({ _id: 'o2', orderId: 'ORD-2', status: 'Delivered' })], actions });
    expect(screen.getAllByText('Assign')).toHaveLength(2); // table cell + mobile card, for the Placed order only
    expect(container.querySelectorAll('.oc-actions')).toHaveLength(1);
  });
});
