import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const icon = (color, emoji, pulse = false) =>
  L.divIcon({
    className: '',
    html: `<div class="pin ${pulse ? 'pin-pulse' : ''}" style="background:${color}"><span>${emoji}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

export const ICONS = {
  pickup: icon('#1e3a8a', '📦'),
  drop: icon('#16a34a', '🏁'),
  agent: icon('#f97316', '🛵'),
  agentLive: icon('#f97316', '🛵', true),
};

export const TILES = {
  street: {
    label: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  light: {
    label: 'Light',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  dark: {
    label: 'Dark',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

function Fit({ points, fitKey }) {
  const map = useMap();
  const key = fitKey ?? points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [50, 50], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/** Smoothly moves the map to `focus.pos` whenever `focus.key` changes. */
function FlyTo({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus?.pos) map.flyTo(focus.pos, Math.max(map.getZoom(), 14), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);
  return null;
}

/** Keeps tiles correct when the container resizes (fullscreen, rotation). */
function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng) });
  return null;
}

/**
 * markers: [{ id, pos: [lat, lng], icon: 'pickup'|'drop'|'agent'|'agentLive', label, onClick? }]
 * lines:   [{ id, positions, dashed?, color?, weight?, opacity? }]
 * focus:   { key, pos } - fly to a position
 * fitKey:  fixed key that decides when the map re-fits (default: whenever markers move)
 */
export default function MapView({ markers = [], lines = [], onMapClick, fit = true, fitKey, focus, tile = 'street', height = 380 }) {
  const points = markers.map((m) => m.pos);
  const t = TILES[tile] || TILES.street;
  return (
    <MapContainer center={points[0] || [28.6139, 77.209]} zoom={12} style={{ height, borderRadius: 12 }}>
      <TileLayer key={tile} attribution={t.attribution} url={t.url} />
      {lines.map((l) => (
        <Polyline
          key={l.id}
          positions={l.positions}
          pathOptions={{ color: l.color || '#64748b', weight: l.weight || 3, opacity: l.opacity ?? 0.9, dashArray: l.dashed ? '6 8' : undefined }}
        />
      ))}
      {markers.map((m) => (
        <Marker key={m.id} position={m.pos} icon={ICONS[m.icon]} eventHandlers={m.onClick ? { click: m.onClick } : undefined}>
          {m.label && <Popup>{m.label}</Popup>}
        </Marker>
      ))}
      {fit && <Fit points={points} fitKey={fitKey} />}
      {focus && <FlyTo focus={focus} />}
      <ResizeWatcher />
      {onMapClick && <ClickHandler onClick={onMapClick} />}
    </MapContainer>
  );
}
