import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Navigation,
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { RouteMapViewer } from '../components/RouteMapViewer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { Booking } from '../types.ts';

export function TrackingPage() {
  const { bookingId } = useParams<{ bookingId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchCode, setSearchCode] = useState(bookingId || '');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  const loadTracking = useCallback(async (idOrCode: string) => {
    if (!idOrCode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ booking: Booking }>(`/tracking/${idOrCode}`);
      setBooking(res.booking);
    } catch (err) {
      setBooking(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load shipment tracking. Please ensure you are signed in with access to this booking.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bookingId) {
      setSearchCode(bookingId);
      void loadTracking(bookingId);
    } else {
      setLoading(false);
    }
  }, [bookingId, loadTracking]);

  const handleSimulateStep = async () => {
    if (!booking) return;
    setSimBusy(true);
    try {
      await apiRequest(`/tracking/${booking._id}/simulate-step`, { method: 'POST' });
      await loadTracking(booking._id);
    } catch {
      // ignore
    } finally {
      setSimBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link
          to={user ? `/dashboard/${user.role}` : '/'}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{user ? 'Back to Dashboard' : 'Back to Homepage'}</span>
        </Link>
        <div className="font-display font-bold text-base text-slate-950">
          RouteBack Shipment Tracking
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchCode.trim()) navigate(`/track/${searchCode.trim()}`);
          }}
          className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Enter Booking ID (e.g., RB-2026-1043)"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 bg-slate-950 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 whitespace-nowrap"
          >
            Track Booking
          </button>
        </form>

        {loading && (
          <div className="p-8 rounded-xl bg-white border border-slate-200 text-sm text-slate-500">
            Loading shipment tracking telemetry...
          </div>
        )}

        {!loading && error && (
          <div className="p-6 rounded-xl bg-white border border-rose-200 space-y-3">
            <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            {!user && (
              <Link
                to="/login/customer"
                className="inline-block px-4 py-2 bg-slate-950 text-white text-xs font-semibold rounded-lg"
              >
                Sign in to View Protected Shipment Tracking
              </Link>
            )}
          </div>
        )}

        {!loading && booking && (
          <div className="space-y-6">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
              <span>
                <strong>Simulated GPS Tracking Mode:</strong> Vehicle coordinates and corridor milestones are simulated for prototype demonstration rather than live hardware telematics.
              </span>
              {booking.status !== 'Delivered' && booking.status !== 'Cancelled' && (
                <button
                  type="button"
                  disabled={simBusy}
                  onClick={() => void handleSimulateStep()}
                  className="px-3 py-1.5 bg-amber-900 text-white text-xs font-semibold rounded-lg shrink-0"
                >
                  {simBusy ? 'Updating...' : 'Simulate GPS Checkpoint'}
                </button>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <div className="text-xs text-slate-500">Booking ID</div>
                <div className="text-base font-mono font-bold text-slate-950 mt-0.5">
                  {booking.bookingCode}
                </div>
                <div className="text-xs font-semibold text-emerald-700 mt-1">{booking.status}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Driver &amp; Vehicle</div>
                <div className="text-sm font-bold text-slate-950 mt-0.5">
                  {booking.driver?.fullName}
                </div>
                <div className="text-xs font-mono text-slate-600 mt-0.5">
                  {booking.vehicle?.registrationNumber} · {booking.vehicle?.modelName}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Corridor</div>
                <div className="text-sm font-bold text-slate-950 mt-0.5">
                  {booking.pickupLocation} → {booking.deliveryLocation}
                </div>
                <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
                  {booking.distanceKm} km · {booking.weightKg} kg
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Expected Delivery Date</div>
                <div className="text-sm font-bold text-slate-950 mt-0.5 tabular-nums">
                  {booking.pickupDate}
                </div>
                <div className="text-xs text-slate-600 mt-0.5 tabular-nums inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    ETA: {booking.tracking?.etaMinutes ?? 0} mins remaining
                  </span>
                </div>
              </div>
            </div>

            <RouteMapViewer
              pickupLabel={booking.pickupLocation}
              deliveryLabel={booking.deliveryLocation}
              pickupCoords={booking.pickupCoords}
              deliveryCoords={booking.deliveryCoords}
              currentTruckCoords={booking.tracking?.currentCoords}
              progressPercent={booking.tracking?.progressPercent}
              fallbackDistanceKm={booking.distanceKm}
              heightClass="h-80"
            />

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-base font-display font-bold text-slate-950 mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-700" />
                <span>Shipment Milestone History</span>
              </h2>
              <div className="space-y-4">
                {(booking.tracking?.history || []).map((ev, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="flex-1 pb-3 border-b border-slate-100 last:border-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-950">
                          {ev.status} · {ev.locationName}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {new Date(ev.timestamp).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{ev.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
