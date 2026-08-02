'use client';

import type {
  LayerGroup,
  Map as LeafletMap,
} from 'leaflet';
import {
  MapPin,
  Radio,
  Smartphone,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Badge,
  Card,
  EmptyState,
} from '@/components/ui';

export type LiveMapUser = {
  userId: string;
  name: string;
  email?: string | null;
  platform: string;
  device?: string | null;
  screen?: string | null;
  lastSeenAt: string;
};

export type LiveMapPoint = {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  country_code?: string | null;
  live_users: number;
  installations: number;
  ios_users: number;
  android_users: number;
  web_users: number;
  last_seen_at: string;
  users: LiveMapUser[];
};

type Props = {
  points: LiveMapPoint[];
  loading?: boolean;
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function popup(point: LiveMapPoint) {
  const people = point.users
    .slice(0, 8)
    .map(
      (user) => `
        <li style="
          display:flex;
          justify-content:space-between;
          gap:12px;
          padding:7px 0;
          border-top:1px solid #edf1f5;
        ">
          <span>
            <strong>${escapeHtml(user.name)}</strong><br />
            <small style="color:#718096">
              ${escapeHtml(user.device || user.platform)}
            </small>
          </span>
          <small style="color:#718096;text-align:right">
            ${escapeHtml(user.screen || 'Unknown screen')}
          </small>
        </li>
      `,
    )
    .join('');

  const additional =
    point.users.length > 8
      ? `<p style="margin:8px 0 0;color:#718096;font-size:12px">
          +${point.users.length - 8} more users
        </p>`
      : '';

  return `
    <div style="
      min-width:260px;
      max-width:340px;
      color:#26384a;
      font-family:Arial,sans-serif;
    ">
      <p style="
        margin:0 0 4px;
        color:#02aeb8;
        font-size:11px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      ">Live location</p>

      <h3 style="margin:0;font-size:18px;line-height:1.25">
        ${escapeHtml(point.city)}, ${escapeHtml(point.country)}
      </h3>

      <p style="margin:8px 0 12px;color:#58697b;font-size:13px">
        <strong>${point.live_users}</strong> live ${
          point.live_users === 1 ? 'user' : 'users'
        }
        · ${point.installations} ${
          point.installations === 1
            ? 'installation'
            : 'installations'
        }
      </p>

      <div style="
        display:flex;
        gap:6px;
        flex-wrap:wrap;
        margin-bottom:10px;
      ">
        <span style="
          padding:4px 8px;
          border-radius:999px;
          background:#eef3ff;
          color:#425f9b;
          font-size:11px;
          font-weight:700;
        ">iOS ${point.ios_users}</span>

        <span style="
          padding:4px 8px;
          border-radius:999px;
          background:#ecf8ee;
          color:#287442;
          font-size:11px;
          font-weight:700;
        ">Android ${point.android_users}</span>

        ${
          point.web_users > 0
            ? `<span style="
                padding:4px 8px;
                border-radius:999px;
                background:#f4efff;
                color:#6c49a2;
                font-size:11px;
                font-weight:700;
              ">Web ${point.web_users}</span>`
            : ''
        }
      </div>

      <ul style="
        list-style:none;
        padding:0;
        margin:0;
        max-height:220px;
        overflow:auto;
      ">${people}</ul>

      ${additional}
    </div>
  `;
}

export function LiveUserMap({
  points,
  loading = false,
}: Props) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const mappedUsers = useMemo(
    () =>
      points.reduce(
        (total, point) =>
          total + Number(point.live_users || 0),
        0,
      ),
    [points],
  );

  useEffect(() => {
    let active = true;

    async function createMap() {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      try {
        const L = await import('leaflet');

        if (!active || !containerRef.current) {
          return;
        }

        const map = L.map(containerRef.current, {
          center: [20, 0],
          zoom: 2,
          minZoom: 2,
          maxZoom: 12,
          worldCopyJump: true,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            maxZoom: 19,
            attribution:
              '&copy; OpenStreetMap contributors',
          },
        ).addTo(map);

        const layer = L.layerGroup().addTo(map);

        mapRef.current = map;
        layerRef.current = layer;
        setReady(true);

        setTimeout(() => {
          map.invalidateSize();
        }, 0);
      } catch (mapError) {
        setError(
          mapError instanceof Error
            ? mapError.message
            : 'The live map could not be loaded.',
        );
      }
    }

    void createMap();

    return () => {
      active = false;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !layerRef.current) {
      return;
    }

    let active = true;

    async function drawPoints() {
      const L = await import('leaflet');

      if (
        !active ||
        !mapRef.current ||
        !layerRef.current
      ) {
        return;
      }

      const layer = layerRef.current;
      layer.clearLayers();

      const valid = points.filter(
        (point) =>
          Number.isFinite(Number(point.latitude)) &&
          Number.isFinite(Number(point.longitude)),
      );

      for (const point of valid) {
        const count = Math.max(
          1,
          Number(point.live_users || 1),
        );

        const radius = Math.min(
          25,
          8 + Math.sqrt(count) * 4,
        );

        const marker = L.circleMarker(
          [
            Number(point.latitude),
            Number(point.longitude),
          ],
          {
            radius,
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillColor: '#FF6685',
            fillOpacity: 0.92,
            className: 'hold-live-map-marker',
          },
        );

        marker.bindTooltip(
          `${point.city}, ${point.country}: ${count} live`,
          {
            direction: 'top',
            offset: [0, -radius],
          },
        );

        marker.bindPopup(popup(point), {
          maxWidth: 360,
          minWidth: 280,
        });

        marker.addTo(layer);
      }

      if (valid.length === 1) {
        mapRef.current.setView(
          [
            Number(valid[0].latitude),
            Number(valid[0].longitude),
          ],
          6,
          { animate: true },
        );
      } else if (valid.length > 1) {
        const bounds = L.latLngBounds(
          valid.map((point) => [
            Number(point.latitude),
            Number(point.longitude),
          ]),
        );

        mapRef.current.fitBounds(bounds, {
          padding: [42, 42],
          maxZoom: 7,
          animate: true,
        });
      }
    }

    void drawPoints();

    return () => {
      active = false;
    };
  }, [points, ready]);

  return (
    <Card style={{ marginTop: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
            }}
          >
            <MapPin size={21} />
            <h2 style={{ margin: 0 }}>
              Live user map
            </h2>
          </div>

          <p
            className="muted"
            style={{ marginTop: 6 }}
          >
            City-level active users reported by iOS and
            Android during the last three minutes.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Badge tone="good">
            <Radio size={13} />
            {mappedUsers} mapped live
          </Badge>

          <Badge tone="neutral">
            <Smartphone size={13} />
            {points.length} locations
          </Badge>
        </div>
      </div>

      {error ? (
        <p className="error">{error}</p>
      ) : null}

      {!loading && points.length === 0 ? (
        <EmptyState
          title="No live map locations yet"
          body="Open the updated iOS or Android app while signed in and with location permission enabled. Locations are rounded to a city-level grid."
        />
      ) : (
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            height: 460,
            border: '1px solid #E3E9F0',
            borderRadius: 20,
            background: '#EAF2F5',
          }}
        >
          <div
            ref={containerRef}
            aria-label="Live Hold users by city and country"
            style={{
              width: '100%',
              height: '100%',
            }}
          />

          {loading ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 500,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,.72)',
                backdropFilter: 'blur(3px)',
              }}
            >
              <strong>Loading live locations…</strong>
            </div>
          ) : null}
        </div>
      )}

      <p
        className="muted"
        style={{
          marginTop: 12,
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        Privacy: coordinates are rounded before upload and
        represent an approximate city-level area. The map is
        for operational analytics, not precise person tracking.
      </p>
    </Card>
  );
}
