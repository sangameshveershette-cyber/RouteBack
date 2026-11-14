import React, { useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Navigation, Clock, Route as RouteIcon, AlertTriangle } from 'lucide-react';
import { useMapsConfig } from '../context/MapsContext.tsx';
import type { LatLng } from '../types.ts';

interface RouteMapViewerProps {
  pickupLabel: string;
  deliveryLabel: string;
  pickupCoords: LatLng;
  deliveryCoords: LatLng;
  driverOriginLabel?: string;
  driverOriginCoords?: LatLng;
  driverDestLabel?: string;
  driverDestCoords?: LatLng;
  currentTruckCoords?: LatLng;
  progressPercent?: number;
  fallbackDistanceKm?: number;
  fallbackDurationMin?: number;
  heightClass?: string;
}

function LiveRoutesOverlay({
  pickupCoords,
  deliveryCoords,
  driverOriginCoords,
  driverDestCoords,
  onMetrics,
  onFallbackNeeded,
}: {
  pickupCoords: LatLng;
  deliveryCoords: LatLng;
  driverOriginCoords?: LatLng;
  driverDestCoords?: LatLng;
  onMetrics: (distanceKm: number, durationMin: number, viaGoogle: boolean) => void;
  onFallbackNeeded: () => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map || !routesLib) return;

    let cancelled = false;
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const runRoute = async () => {
      try {
        const RouteClass = routesLib.Route as unknown as {
          computeRoutes: (req: Record<string, unknown>) => Promise<{ routes: unknown[] }>;
        };

        // 1. Primary shipment route
        const shipmentReq = {
          origin: pickupCoords,
          destination: deliveryCoords,
          travelMode: 'DRIVING',
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
        };

        const res = await RouteClass.computeRoutes(shipmentReq);
        if (cancelled) return;

        if (res.routes && res.routes.length > 0) {
          const primary = res.routes[0] as {
            createPolylines: () => google.maps.Polyline[];
            viewport?: google.maps.LatLngBounds;
            distanceMeters?: number;
            durationMillis?: number;
          };

          const created = primary.createPolylines();
          created.forEach((pl) => {
            pl.setOptions({
              strokeColor: '#16A34A',
              strokeOpacity: 0.95,
              strokeWeight: 5,
            });
            pl.setMap(map);
          });
          polylinesRef.current.push(...created);

          if (primary.viewport) {
            map.fitBounds(primary.viewport);
          }

          if (primary.distanceMeters && primary.durationMillis) {
            onMetrics(
              Math.round(primary.distanceMeters / 1000),
              Math.round(primary.durationMillis / 60000),
              true
            );
          }
        }

        // 2. Optional driver return corridor overlay for comparison
        if (driverOriginCoords && driverDestCoords) {
          const driverReq = {
            origin: driverOriginCoords,
            destination: driverDestCoords,
            travelMode: 'DRIVING',
            fields: ['path'],
          };
          const drvRes = await RouteClass.computeRoutes(driverReq).catch(() => null);
          if (!cancelled && drvRes?.routes?.[0]) {
            const drvRoute = drvRes.routes[0] as {
              createPolylines: () => google.maps.Polyline[];
            };
            const drvLines = drvRoute.createPolylines();
            drvLines.forEach((pl) => {
              pl.setOptions({
                strokeColor: '#0F172A',
                strokeOpacity: 0.45,
                strokeWeight: 4,
              });
              pl.setMap(map);
            });
            polylinesRef.current.push(...drvLines);
          }
        }
      } catch (err) {
        const msg = String(err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onFallbackNeeded();
      }
    };

    void runRoute();

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [
    map,
    routesLib,
    pickupCoords.lat,
    pickupCoords.lng,
    deliveryCoords.lat,
    deliveryCoords.lng,
    driverOriginCoords?.lat,
    driverOriginCoords?.lng,
    driverDestCoords?.lat,
    driverDestCoords?.lng,
  ]);

  return null;
}

function DemoSvgRouteMap({
  pickupLabel,
  deliveryLabel,
  pickupCoords,
  deliveryCoords,
  driverOriginLabel,
  driverOriginCoords,
  driverDestLabel,
  driverDestCoords,
  currentTruckCoords,
  progressPercent,
  distanceKm,
  durationMin,
  heightClass,
  reason,
}: RouteMapViewerProps & { distanceKm: number; durationMin: number; reason: string }) {
  const points: LatLng[] = [pickupCoords, deliveryCoords];
  if (driverOriginCoords) points.push(driverOriginCoords);
  if (driverDestCoords) points.push(driverDestCoords);
  if (currentTruckCoords) points.push(currentTruckCoords);

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats) - 0.35;
  const maxLat = Math.max(...lats) + 0.35;
  const minLng = Math.min(...lngs) - 0.45;
  const maxLng = Math.max(...lngs) + 0.45;

  const project = (c: LatLng) => {
    const x = 60 + ((c.lng - minLng) / Math.max(0.01, maxLng - minLng)) * 480;
    const y = 210 - ((c.lat - minLat) / Math.max(0.01, maxLat - minLat)) * 160;
    return { x, y };
  };

  const p1 = project(pickupCoords);
  const p2 = project(deliveryCoords);
  const d1 = driverOriginCoords ? project(driverOriginCoords) : null;
  const d2 = driverDestCoords ? project(driverDestCoords) : null;
  const truckPt = currentTruckCoords ? project(currentTruckCoords) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-950 text-white overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-amber-300 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Demo Route Visualization ({reason})</span>
        </div>
        <div className="flex items-center gap-4 text-slate-300 tabular-nums">
          <span>Est. Distance: {distanceKm} km</span>
          <span aria-hidden="true">·</span>
          <span>Est. Transit: ~{Math.floor(durationMin / 60)}h {durationMin % 60}m</span>
        </div>
      </div>

      <div className={`relative w-full ${heightClass || 'h-64'} bg-slate-950`}>
        <svg viewBox="0 0 600 250" className="w-full h-full">
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke="rgba(148,163,184,0.08)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="600" height="250" fill="url(#grid)" />

          {d1 && d2 && (
            <line
              x1={d1.x}
              y1={d1.y}
              x2={d2.x}
              y2={d2.y}
              stroke="#64748b"
              strokeWidth="3"
              strokeDasharray="6 6"
            />
          )}

          <path
            d={`M ${p1.x} ${p1.y} Q ${(p1.x + p2.x) / 2} ${Math.min(p1.y, p2.y) - 24} ${p2.x} ${p2.y}`}
            fill="none"
            stroke="#16A34A"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {d1 && driverOriginLabel && (
            <g>
              <circle cx={d1.x} cy={d1.y} r="5" fill="#94a3b8" />
              <text x={d1.x + 8} y={d1.y + 14} fill="#94a3b8" fontSize="10">
                Driver Start: {driverOriginLabel}
              </text>
            </g>
          )}
          {d2 && driverDestLabel && (
            <g>
              <circle cx={d2.x} cy={d2.y} r="5" fill="#94a3b8" />
              <text x={d2.x - 10} y={d2.y + 18} fill="#94a3b8" fontSize="10" textAnchor="end">
                Driver Dest: {driverDestLabel}
              </text>
            </g>
          )}

          <g>
            <circle cx={p1.x} cy={p1.y} r="8" fill="#16A34A" stroke="#ffffff" strokeWidth="2.5" />
            <text x={p1.x} y={p1.y - 14} fill="#ffffff" fontSize="12" fontWeight="600" textAnchor="middle">
              Pickup: {pickupLabel}
            </text>
          </g>

          <g>
            <circle cx={p2.x} cy={p2.y} r="8" fill="#0EA5E9" stroke="#ffffff" strokeWidth="2.5" />
            <text x={p2.x} y={p2.y - 14} fill="#ffffff" fontSize="12" fontWeight="600" textAnchor="middle">
              Delivery: {deliveryLabel}
            </text>
          </g>

          {truckPt && (
            <g>
              <circle cx={truckPt.x} cy={truckPt.y} r="11" fill="#F59E0B" stroke="#0F172A" strokeWidth="2.5" />
              <text x={truckPt.x} y={truckPt.y + 3.5} fill="#0F172A" fontSize="9" fontWeight="700" textAnchor="middle">
                GPS
              </text>
              {progressPercent !== undefined && (
                <text x={truckPt.x} y={truckPt.y + 22} fill="#FCD34D" fontSize="10" fontWeight="600" textAnchor="middle">
                  Simulated Truck ({progressPercent}%)
                </text>
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

export function RouteMapViewer(props: RouteMapViewerProps) {
  const { hasKey, quotaExceeded } = useMapsConfig();
  const loadingStatus = useApiLoadingStatus();
  const [fallbackActive, setFallbackActive] = useState(false);

  const initialDist = props.fallbackDistanceKm || 145;
  const initialDur = props.fallbackDurationMin || Math.round((initialDist / 48) * 60);
  const [metrics, setMetrics] = useState({
    distanceKm: initialDist,
    durationMin: initialDur,
    viaGoogle: false,
  });

  useEffect(() => {
    setMetrics({
      distanceKm: props.fallbackDistanceKm || 145,
      durationMin: props.fallbackDurationMin || Math.round(((props.fallbackDistanceKm || 145) / 48) * 60),
      viaGoogle: false,
    });
  }, [props.fallbackDistanceKm, props.fallbackDurationMin, props.pickupLabel, props.deliveryLabel]);

  const mapsFailed =
    !hasKey ||
    quotaExceeded ||
    fallbackActive ||
    loadingStatus === APILoadingStatus.FAILED ||
    loadingStatus === APILoadingStatus.AUTH_FAILURE;

  if (mapsFailed) {
    const reason = quotaExceeded
      ? 'Maps quota reached'
      : !hasKey
        ? 'Corridor fallback active'
        : 'Fallback route view';
    return (
      <DemoSvgRouteMap
        {...props}
        distanceKm={metrics.distanceKm}
        durationMin={metrics.durationMin}
        reason={reason}
      />
    );
  }

  const midCenter: LatLng = {
    lat: (props.pickupCoords.lat + props.deliveryCoords.lat) / 2,
    lng: (props.pickupCoords.lng + props.deliveryCoords.lng) / 2,
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-medium">
          <RouteIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {props.pickupLabel} → {props.deliveryLabel}
          </span>
          <span aria-hidden="true" className="text-slate-500">·</span>
          <span className="text-slate-300">
            {metrics.viaGoogle ? 'Google Maps Routes API' : 'Highway Route Preview'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-200 tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5 text-emerald-400" />
            {metrics.distanceKm} km
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            ~{Math.floor(metrics.durationMin / 60)}h {metrics.durationMin % 60}m
          </span>
        </div>
      </div>

      <div className={`w-full ${props.heightClass || 'h-72'} relative`}>
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={midCenter}
          defaultZoom={7}
          gestureHandling="greedy"
          disableDefaultUI={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker position={props.pickupCoords} title={`Pickup: ${props.pickupLabel}`}>
            <Pin background="#16A34A" borderColor="#14532D" glyphColor="#FFFFFF" />
          </AdvancedMarker>

          <AdvancedMarker position={props.deliveryCoords} title={`Delivery: ${props.deliveryLabel}`}>
            <Pin background="#0F172A" borderColor="#020617" glyphColor="#FFFFFF" />
          </AdvancedMarker>

          {props.driverOriginCoords && (
            <AdvancedMarker
              position={props.driverOriginCoords}
              title={`Driver Return Start: ${props.driverOriginLabel || ''}`}
            >
              <Pin background="#64748B" borderColor="#334155" glyphColor="#FFFFFF" scale={0.85} />
            </AdvancedMarker>
          )}

          {props.currentTruckCoords && (
            <AdvancedMarker
              position={props.currentTruckCoords}
              title="Simulated Truck GPS Position"
            >
              <div className="px-2 py-1 rounded-md bg-amber-500 text-slate-950 font-bold text-[11px] shadow-md border border-amber-700">
                Truck ({props.progressPercent ?? 0}%)
              </div>
            </AdvancedMarker>
          )}

          <LiveRoutesOverlay
            pickupCoords={props.pickupCoords}
            deliveryCoords={props.deliveryCoords}
            driverOriginCoords={props.driverOriginCoords}
            driverDestCoords={props.driverDestCoords}
            onMetrics={(d, m, viaGoogle) =>
              setMetrics({ distanceKm: d, durationMin: m, viaGoogle })
            }
            onFallbackNeeded={() => setFallbackActive(true)}
          />
        </GoogleMap>
      </div>
    </div>
  );
}
