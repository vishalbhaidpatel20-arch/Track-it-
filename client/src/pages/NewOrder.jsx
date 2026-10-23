import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg } from '../api.js';
import Icon from '../components/Icon.jsx';
import MapView from '../components/MapView.jsx';
import { Alert } from '../components/ui.jsx';

const empty = { address: '', lat: null, lng: null };

async function geocode(q) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
  const [hit] = await res.json();
  if (!hit) throw new Error('Address not found - try a more specific one or tap the map');
  return { lat: Number(hit.lat), lng: Number(hit.lon) };
}

async function reverse(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    return (await res.json()).display_name || '';
  } catch {
    return '';
  }
}

export default function NewOrder() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState(empty);
  const [drop, setDrop] = useState(empty);
  const [target, setTarget] = useState('pickup'); // which point a map tap sets
  const [packageDescription, setDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const setters = { pickup: setPickup, drop: setDrop };
  const values = { pickup, drop };
  const isSet = (p) => p.lat != null;

  const search = async (which) => {
    setError('');
    try {
      const pos = await geocode(values[which].address);
      setters[which]((p) => ({ ...p, ...pos }));
      if (which === 'pickup') setTarget('drop');
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const onMapClick = async ({ lat, lng }) => {
    setters[target]((p) => ({ ...p, lat, lng }));
    const address = await reverse(lat, lng);
    setters[target]((p) => ({ ...p, address: p.address || address || `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
    if (target === 'pickup') setTarget('drop');
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError('Location is not available on this device');
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const address = await reverse(coords.latitude, coords.longitude);
        setPickup({ lat: coords.latitude, lng: coords.longitude, address: address || 'My current location' });
        setTarget('drop');
        setLocating(false);
      },
      () => {
        setError('Could not get your location. Allow location access or tap the map instead.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const markers = [
    isSet(pickup) && { id: 'p', pos: [pickup.lat, pickup.lng], icon: 'pickup', label: 'Pickup' },
    isSet(drop) && { id: 'd', pos: [drop.lat, drop.lng], icon: 'drop', label: 'Drop' },
  ].filter(Boolean);

  const submit = async (e) => {
    e.preventDefault();
    if (!isSet(pickup) || !isSet(drop)) return setError('Set both pickup and drop locations (search or tap the map).');
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/orders', { pickup, drop, packageDescription, notes: notes || undefined });
      navigate(`/orders/${data.order._id}`);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  const field = (which, label, step) => (
    <div className={`point ${target === which ? 'target' : ''}`}>
      <div className="point-head">
        <span className={`step-no ${isSet(values[which]) ? 'ok' : ''}`}>{isSet(values[which]) ? '✓' : step}</span>
        <strong>{label}</strong>
        {which === 'pickup' && (
          <button type="button" className="btn small loc-btn" onClick={useMyLocation} disabled={locating}>
            <Icon name="crosshair" size={15} /> {locating ? 'Locating…' : 'Use my location'}
          </button>
        )}
      </div>
      <div className="row">
        <input
          placeholder="Search an address…"
          value={values[which].address}
          enterKeyHint="search"
          onFocus={() => setTarget(which)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search(which))}
          onChange={(e) => setters[which]({ ...values[which], address: e.target.value })}
        />
        <button type="button" className="btn" onClick={() => search(which)} disabled={values[which].address.length < 3}>
          Find
        </button>
      </div>
      <small className={isSet(values[which]) ? 'ok-text' : 'muted'}>
        {isSet(values[which]) ? `Location set (${values[which].lat.toFixed(4)}, ${values[which].lng.toFixed(4)})` : 'Search, or tap the map to set this point'}
      </small>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Place a new order</h2>
          <p className="muted small">Choose pickup and drop on the map, then describe your package.</p>
        </div>
      </div>
      <form className="neworder-grid" onSubmit={submit}>
        <div className="card pad stack">
          <Alert>{error}</Alert>
          {field('pickup', 'Pickup location', 1)}
          {field('drop', 'Drop location', 2)}
          <label>
            <span className="label-row">
              <span className="step-no">3</span> Package description
            </span>
            <input required value={packageDescription} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Documents, 1 small box" />
          </label>
          <label>
            Notes for the agent (optional)
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="submit-bar">
            <button className="btn primary" disabled={busy}>
              {busy ? 'Placing…' : 'Place order'}
            </button>
          </div>
        </div>
        <div className="card pad neworder-map">
          <p className="map-hint">
            Tap the map to set the <strong>{target === 'pickup' ? 'pickup' : 'drop'}</strong> point
          </p>
          <MapView markers={markers} onMapClick={onMapClick} height={420} />
        </div>
      </form>
    </>
  );
}
