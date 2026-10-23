import '../setup-env.js';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeDueAt, haversineKm } from '../../src/services/orders.js';

const CP = { lat: 28.6315, lng: 77.2167 };
const GATE = { lat: 28.6129, lng: 77.2295 };

describe('haversineKm', () => {
  test('is zero for identical points', () => {
    assert.equal(haversineKm(CP, CP), 0);
  });

  test('Connaught Place to India Gate is about 2.4 km', () => {
    const d = haversineKm(CP, GATE);
    assert.ok(d > 2.2 && d < 2.7, `got ${d}`);
  });

  test('is symmetric', () => {
    assert.equal(haversineKm(CP, GATE), haversineKm(GATE, CP));
  });

  test('one degree of latitude is about 111 km', () => {
    const d = haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    assert.ok(Math.abs(d - 111.2) < 0.5, `got ${d}`);
  });
});

describe('computeDueAt', () => {
  const from = new Date('2026-01-01T10:00:00Z');

  test('adds 30 minutes handling time for a zero-distance order', () => {
    assert.equal(computeDueAt(0, from).toISOString(), '2026-01-01T10:30:00.000Z');
  });

  test('adds travel time at 25 km/h on top of handling time', () => {
    assert.equal(computeDueAt(25, from).toISOString(), '2026-01-01T11:30:00.000Z'); // 30 + 60 min
    assert.equal(computeDueAt(12.5, from).toISOString(), '2026-01-01T11:00:00.000Z'); // 30 + 30 min
  });

  test('longer trips are due later', () => {
    assert.ok(computeDueAt(20, from) > computeDueAt(5, from));
  });
});
