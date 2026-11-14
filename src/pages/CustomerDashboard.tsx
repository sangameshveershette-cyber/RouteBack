import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Package,
  Truck,
  Leaf,
  User as UserIcon,
  Star,
  MapPin,
  CheckCircle2,
  XCircle,
  Navigation,
  IndianRupee,
} from 'lucide-react';
import { DashboardShell, type NavItem } from '../components/DashboardShell.tsx';
import { LocationAutocompleteInput } from '../components/LocationAutocompleteInput.tsx';
import { RouteMapViewer } from '../components/RouteMapViewer.tsx';
import { ImpactSection } from '../components/ImpactSection.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type {
  Booking,
  LatLng,
  RankedMatch,
  ReturnTrip,
  ShipmentRequest,
} from '../types.ts';

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'find', label: 'Find Transport', icon: Search },
  { id: 'bookings', label: 'My Bookings', icon: Package },
  { id: 'shipments', label: 'Shipment Requests', icon: Truck },
  { id: 'impact', label: 'Eco Impact', icon: Leaf },
  { id: 'profile', label: 'Profile', icon: UserIcon },
];

export function CustomerDashboard() {
  const { user, profile, refreshMe } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shipments, setShipments] = useState<ShipmentRequest[]>([]);
  const [openTrips, setOpenTrips] = useState<ReturnTrip[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Shipment + Smart Matching Form
  const [pickupLocation, setPickupLocation] = useState('Mysuru');
  const [deliveryLocation, setDeliveryLocation] = useState('Bengaluru');
  const [pickupCoords, setPickupCoords] = useState<LatLng | undefined>({ lat: 12.2958, lng: 76.6394 });
  const [deliveryCoords, setDeliveryCoords] = useState<LatLng | undefined>({ lat: 12.9716, lng: 77.5946 });
  const [pickupDate, setPickupDate] = useState('2026-11-20');
  const [goodsCategory, setGoodsCategory] = useState('Electronics & Commercial Cartons');
  const [weightKg, setWeightKg] = useState('300');
  const [dimensions, setDimensions] = useState('120 x 90 x 80 cm');
  const [preferredVehicleType, setPreferredVehicleType] = useState('Suitable small commercial vehicle');

  const [matchingBusy, setMatchingBusy] = useState(false);
  const [matches, setMatches] = useState<RankedMatch[]>([]);
  const [matchSummary, setMatchSummary] = useState<{
    evaluated: number;
    matched: number;
    rejected: number;
    shipmentId?: string;
    queryCoords?: { pickup: LatLng; delivery: LatLng };
  } | null>(null);
  const [expandedMapTripId, setExpandedMapTripId] = useState<string | null>(null);

  // Booking Confirmation Modal
  const [confirmMatch, setConfirmMatch] = useState<RankedMatch | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [recentBookingCode, setRecentBookingCode] = useState<string | null>(null);

  // Review Modal
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Profile Form
  const [profName, setProfName] = useState(user?.fullName || '');
  const [profAddress, setProfAddress] = useState(user?.address || '');

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [bkRes, shRes, trRes] = await Promise.all([
        apiRequest<{ bookings: Booking[] }>('/bookings'),
        apiRequest<{ shipments: ShipmentRequest[] }>('/shipments'),
        apiRequest<{ trips: ReturnTrip[] }>('/return-trips?scope=all'),
      ]);
      setBookings(bkRes.bookings || []);
      setShipments(shRes.shipments || []);
      setOpenTrips(trRes.trips || []);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to load dashboard data.',
      });
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (user) {
      setProfName(user.fullName);
      setProfAddress(user.address);
    }
  }, [user]);

  const totalBookingsCount = bookings.length;
  const activeShipmentsCount = bookings.filter((b) =>
    ['Pending', 'Accepted', 'Confirmed', 'Pickup Scheduled', 'Picked Up', 'In Transit'].includes(
      b.status
    )
  ).length;
  const completedCount = bookings.filter((b) => b.status === 'Delivered').length;
  const moneySpent = bookings
    .filter((b) => b.status === 'Delivered')
    .reduce((acc, b) => acc + b.agreedFare, 0);

  const runSmartMatch = async (e?: React.FormEvent, existingShipment?: ShipmentRequest) => {
    if (e) e.preventDefault();
    setFeedback(null);
    setMatchingBusy(true);
    setRecentBookingCode(null);
    try {
      let shipmentId = existingShipment?._id;
      if (!existingShipment) {
        const createdSh = await apiRequest<{ shipment: ShipmentRequest }>('/shipments', {
          method: 'POST',
          body: JSON.stringify({
            pickupLocation,
            deliveryLocation,
            pickupCoords,
            deliveryCoords,
            pickupDate,
            goodsCategory,
            weightKg: Number(weightKg),
            dimensions,
            preferredVehicleType,
          }),
        });
        shipmentId = createdSh.shipment._id;
        setShipments((prev) => [createdSh.shipment, ...prev]);
      }

      const matchRes = await apiRequest<{
        matches: RankedMatch[];
        totalEvaluated: number;
        matchedCount: number;
        rejectedCount: number;
        query: { pickupCoords: LatLng; deliveryCoords: LatLng };
      }>('/matching/search', {
        method: 'POST',
        body: JSON.stringify({ shipmentId }),
      });

      setMatches(matchRes.matches || []);
      setMatchSummary({
        evaluated: matchRes.totalEvaluated,
        matched: matchRes.matchedCount,
        rejected: matchRes.rejectedCount,
        shipmentId,
        queryCoords: {
          pickup: matchRes.query.pickupCoords,
          delivery: matchRes.query.deliveryCoords,
        },
      });
      if (matchRes.matches.length > 0) {
        setExpandedMapTripId(matchRes.matches[0].returnTrip._id);
      }
      setActiveTab('find');
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Smart matching failed.',
      });
    } finally {
      setMatchingBusy(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!confirmMatch) return;
    setBookingBusy(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{ booking: Booking }>('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          returnTripId: confirmMatch.returnTrip._id,
          shipmentId: matchSummary?.shipmentId,
          pickupLocation,
          deliveryLocation,
          pickupCoords: matchSummary?.queryCoords?.pickup || pickupCoords,
          deliveryCoords: matchSummary?.queryCoords?.delivery || deliveryCoords,
          pickupDate,
          goodsCategory,
          weightKg: Number(weightKg),
          dimensions,
          agreedFare: confirmMatch.estimatedFare,
          detourKm: confirmMatch.detourKm,
          matchScore: confirmMatch.score,
        }),
      });
      setRecentBookingCode(res.booking.bookingCode);
      setConfirmMatch(null);
      setFeedback({
        type: 'ok',
        text: `Booking ${res.booking.bookingCode} submitted! Awaiting driver confirmation.`,
      });
      await loadAll();
      setActiveTab('bookings');
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Booking submission failed.',
      });
    } finally {
      setBookingBusy(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setFeedback(null);
    try {
      await apiRequest(`/bookings/${bookingId}/cancel`, { method: 'POST' });
      setFeedback({ type: 'ok', text: 'Booking cancelled and vehicle capacity released.' });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to cancel booking.',
      });
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBooking) return;
    try {
      await apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: reviewBooking._id,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      setReviewBooking(null);
      setReviewComment('');
      setFeedback({ type: 'ok', text: 'Thank you! Your driver rating and review have been saved.' });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to submit review.',
      });
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName: profName, address: profAddress }),
      });
      await refreshMe();
      setFeedback({ type: 'ok', text: 'Customer profile updated.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Profile update failed.',
      });
    }
  };

  return (
    <DashboardShell
      roleLabel="Customer Portal"
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {feedback && (
        <div
          className={`mb-6 p-4 rounded-xl border text-sm flex items-center justify-between gap-4 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-950">
                Welcome back, {user?.fullName}
              </h1>
              <p className="text-sm text-slate-600">
                Create shipment requests, compare smart-matched return vehicles, and monitor deliveries.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('find')}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              <span>Find Return Transport</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Total Bookings</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                {totalBookingsCount}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Active Shipments</div>
              <div className="text-2xl font-display font-bold text-emerald-700 tabular-nums mt-1">
                {activeShipmentsCount}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Completed Deliveries</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                {completedCount}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Money Spent</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                ₹{(moneySpent || Number(profile?.totalSpent || 0)).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Open Return Trips Preview */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-display font-bold text-slate-950">
                  Available Return-Trip Vehicles
                </h2>
                <p className="text-xs text-slate-500">
                  Verified commercial trucks heading back along active highway corridors
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('find')}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Run Smart Match
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {loadingData ? (
                <div className="p-6 text-sm text-slate-500">Loading available return trips...</div>
              ) : openTrips.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No open return trips at the moment.</div>
              ) : (
                openTrips.slice(0, 6).map((trip) => (
                  <div
                    key={trip._id}
                    className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div>
                      <div className="font-semibold text-sm text-slate-950">
                        {trip.currentLocation} → {trip.returnDestination}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
                        {trip.vehicleType} · {trip.availableCapacityKg} kg free · Departs{' '}
                        {trip.departureDate} at {trip.departureTime} · Driver:{' '}
                        {trip.driver?.fullName}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right tabular-nums">
                        <div className="text-sm font-bold text-slate-950">
                          ₹{trip.expectedPrice.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-slate-500">{trip.distanceKm} km</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPickupLocation(trip.currentLocation);
                          setDeliveryLocation(trip.returnDestination);
                          setPickupCoords(trip.currentCoords);
                          setDeliveryCoords(trip.destinationCoords);
                          setPickupDate(trip.departureDate);
                          setActiveTab('find');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-950 text-white rounded-lg hover:bg-slate-800 whitespace-nowrap"
                      >
                        Match Route
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* FIND TRANSPORT & SMART MATCHING TAB */}
      {activeTab === 'find' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
            <h2 className="text-lg font-display font-bold text-slate-950 mb-1">
              Create Shipment Request &amp; Smart Match
            </h2>
            <p className="text-xs text-slate-600 mb-5">
              Weighted scoring: Route compatibility (40%) · Capacity fit (25%) · Schedule alignment (20%) · Detour deviation (15%)
            </p>

            <form onSubmit={(e) => void runSmartMatch(e)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LocationAutocompleteInput
                  id="cust-pickup"
                  label="Pickup Location *"
                  value={pickupLocation}
                  required
                  onChange={(val, coords) => {
                    setPickupLocation(val);
                    setPickupCoords(coords);
                  }}
                />
                <LocationAutocompleteInput
                  id="cust-delivery"
                  label="Delivery Location *"
                  value={deliveryLocation}
                  required
                  onChange={(val, coords) => {
                    setDeliveryLocation(val);
                    setDeliveryCoords(coords);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Pickup Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Goods Category *
                  </label>
                  <select
                    value={goodsCategory}
                    onChange={(e) => setGoodsCategory(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option>Electronics &amp; Commercial Cartons</option>
                    <option>Agri Produce &amp; Grains</option>
                    <option>Industrial Spare Parts</option>
                    <option>Textiles &amp; Garments</option>
                    <option>FMCG &amp; Packaged Goods</option>
                    <option>Furniture &amp; Relocation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Shipment Weight (kg) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Dimensions (Optional)
                  </label>
                  <input
                    type="text"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    placeholder="e.g., 120x90x80 cm"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="sm:w-80">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Preferred Vehicle Type
                  </label>
                  <select
                    value={preferredVehicleType}
                    onChange={(e) => setPreferredVehicleType(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option>Suitable small commercial vehicle</option>
                    <option>Any Suitable Vehicle</option>
                    <option>Tata Ace (Mini Truck)</option>
                    <option>Mahindra Bolero Pickup</option>
                    <option>Ashok Leyland Dost</option>
                    <option>Tata 407 (LCV)</option>
                    <option>Eicher Pro 14ft</option>
                    <option>BharatBenz 17ft Container</option>
                    <option>Heavy Duty 22ft Truck</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={matchingBusy}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Search className="w-4 h-4" />
                  <span>{matchingBusy ? 'Computing Matches...' : 'Save & Find Matching Vehicles'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Matching Results */}
          {matchSummary && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <h3 className="text-base font-display font-bold text-slate-950">
                  Smart Matching Results ({matchSummary.matched} suitable vehicles found)
                </h3>
                <div className="text-xs text-slate-600 tabular-nums">
                  Evaluated {matchSummary.evaluated} open return trips · Rejected {matchSummary.rejected} incompatible routes
                </div>
              </div>

              {matches.length === 0 ? (
                <div className="p-8 rounded-xl bg-white border border-slate-200 text-center">
                  <p className="text-sm font-semibold text-slate-900">
                    No compatible return-trip vehicles matched those exact constraints.
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Try adjusting the pickup date (±1–2 days) or checking available corridors below.
                  </p>
                </div>
              ) : (
                matches.map((m) => {
                  const isMapOpen = expandedMapTripId === m.returnTrip._id;
                  return (
                    <div
                      key={m.returnTrip._id}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                    >
                      <div className="p-5 sm:p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                              <span className="font-semibold text-emerald-700 tabular-nums">
                                {m.score}/100 Match Score
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {m.returnTrip.currentLocation} → {m.returnTrip.returnDestination}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                Departs {m.returnTrip.departureDate} at {m.returnTrip.departureTime}
                              </span>
                            </div>

                            <h4 className="text-lg font-display font-bold text-slate-950">
                              {m.vehicle.modelName} ({m.vehicle.registrationNumber})
                            </h4>

                            <div className="text-sm text-slate-700">
                              Driver: <span className="font-semibold">{m.driverUser.fullName}</span> ·
                              Rating <span className="tabular-nums">{m.driver.ratingAvg.toFixed(1)}</span>/5 ·{' '}
                              {m.driver.experienceYears} yrs exp · Available space:{' '}
                              <span className="font-semibold tabular-nums">
                                {m.returnTrip.availableCapacityKg} kg
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                              {m.explanation}
                            </p>

                            {/* Score Breakdown */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs tabular-nums">
                              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                                <span className="text-slate-500">Route (40%):</span>{' '}
                                <span className="font-semibold text-slate-900">{m.routeScore}/40</span>
                              </div>
                              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                                <span className="text-slate-500">Capacity (25%):</span>{' '}
                                <span className="font-semibold text-slate-900">{m.capacityScore}/25</span>
                              </div>
                              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                                <span className="text-slate-500">Time (20%):</span>{' '}
                                <span className="font-semibold text-slate-900">{m.timeScore}/20</span>
                              </div>
                              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                                <span className="text-slate-500">Detour (15%):</span>{' '}
                                <span className="font-semibold text-slate-900">
                                  {m.distanceScore}/15 (+{m.detourKm} km)
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="lg:w-64 shrink-0 lg:border-l lg:border-slate-200 lg:pl-6 flex flex-col justify-between gap-4">
                            <div>
                              <div className="text-xs text-slate-500">Estimated Return-Trip Fare</div>
                              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-0.5">
                                ₹{m.estimatedFare.toLocaleString('en-IN')}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                                Driver quote: ₹{m.fareBreakdown.driverExpectedFare.toLocaleString('en-IN')} · Est. distance {m.shipmentDistanceKm} km
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmMatch(m)}
                                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg"
                              >
                                Book Vehicle
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedMapTripId(isMapOpen ? null : m.returnTrip._id)
                                }
                                className="w-full py-2 px-4 border border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{isMapOpen ? 'Hide Route Map' : 'View Route Map'}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {isMapOpen && (
                          <div className="mt-5 pt-5 border-t border-slate-200 space-y-3">
                            <RouteMapViewer
                              pickupLabel={pickupLocation}
                              deliveryLabel={deliveryLocation}
                              pickupCoords={matchSummary.queryCoords?.pickup || m.returnTrip.currentCoords}
                              deliveryCoords={
                                matchSummary.queryCoords?.delivery || m.returnTrip.destinationCoords
                              }
                              driverOriginLabel={m.returnTrip.currentLocation}
                              driverOriginCoords={m.returnTrip.currentCoords}
                              driverDestLabel={m.returnTrip.returnDestination}
                              driverDestCoords={m.returnTrip.destinationCoords}
                              fallbackDistanceKm={m.shipmentDistanceKm}
                              fallbackDurationMin={m.returnTrip.estimatedDurationMin}
                            />
                            <div className="text-[11px] text-slate-500">
                              {m.fareBreakdown.disclaimer}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* BOOKINGS & TRACKING TAB */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-display font-bold text-slate-950">
                Bookings &amp; Trip History
              </h2>
              <p className="text-xs text-slate-600">
                Track active shipments, cancel eligible pending bookings, or submit driver reviews.
              </p>
            </div>
          </div>

          {recentBookingCode && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between">
              <div>
                <span className="font-bold">Booking Confirmed Request: {recentBookingCode}</span> — The driver has been notified.
              </div>
              <Link
                to={`/track/${recentBookingCode}`}
                className="text-xs font-semibold underline shrink-0"
              >
                Open Tracking View
              </Link>
            </div>
          )}

          {bookings.length === 0 ? (
            <div className="p-8 rounded-xl bg-white border border-slate-200 text-center">
              <p className="text-sm font-medium text-slate-700">No bookings yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab('find')}
                className="mt-3 px-4 py-2 bg-slate-950 text-white text-xs font-semibold rounded-lg"
              >
                Find Return Transport
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((bk) => {
                const canCancel = ['Pending', 'Accepted', 'Confirmed', 'Pickup Scheduled'].includes(
                  bk.status
                );
                const canReview = bk.status === 'Delivered' && !bk.review;

                return (
                  <div
                    key={bk._id}
                    className="p-5 rounded-xl bg-white border border-slate-200 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-mono text-slate-500">
                          {bk.bookingCode} · Pickup {bk.pickupDate} · {bk.weightKg} kg ({bk.goodsCategory})
                        </div>
                        <h3 className="text-base font-display font-bold text-slate-950 mt-0.5">
                          {bk.pickupLocation} → {bk.deliveryLocation}
                        </h3>
                        <div className="text-xs text-slate-600 mt-1">
                          Vehicle: {bk.vehicle?.modelName} ({bk.vehicle?.registrationNumber}) · Driver:{' '}
                          {bk.driver?.fullName} ({bk.driver?.mobile})
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right tabular-nums">
                          <div className="text-base font-bold text-slate-950">
                            ₹{bk.agreedFare.toLocaleString('en-IN')}
                          </div>
                          <div className="text-xs font-semibold text-emerald-700">{bk.status}</div>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            bk.status === 'Cancelled' || bk.status === 'Rejected'
                              ? 'bg-rose-500'
                              : 'bg-emerald-600'
                          }`}
                          style={{ width: `${bk.tracking?.progressPercent ?? 10}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Current: {bk.tracking?.currentLocationName || bk.pickupLocation}</span>
                        <span className="tabular-nums">
                          {bk.tracking?.isSimulated ? 'Simulated GPS · ' : ''}
                          {bk.tracking?.progressPercent ?? 0}%
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <Link
                        to={`/track/${bk.bookingCode}`}
                        className="px-3.5 py-2 bg-slate-950 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 inline-flex items-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Track Shipment</span>
                      </Link>

                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => void handleCancelBooking(bk._id)}
                          className="px-3.5 py-2 border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-50 inline-flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel Booking</span>
                        </button>
                      )}

                      {canReview && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewBooking(bk);
                            setReviewRating(5);
                          }}
                          className="px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 inline-flex items-center gap-1.5"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>Rate &amp; Review Driver</span>
                        </button>
                      )}

                      {bk.review && (
                        <span className="text-xs text-slate-600 ml-auto">
                          Rated {bk.review.rating}/5: &ldquo;{bk.review.comment}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SHIPMENT REQUESTS TAB */}
      {activeTab === 'shipments' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-display font-bold text-slate-950">
              My Shipment Requests
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('find')}
              className="px-3.5 py-1.5 bg-slate-950 text-white text-xs font-semibold rounded-lg"
            >
              New Shipment
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {shipments.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No shipment requests created yet.</div>
            ) : (
              shipments.map((sh) => (
                <div
                  key={sh._id}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-950">
                      {sh.pickupLocation} → {sh.deliveryLocation}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
                      {sh.goodsCategory} · {sh.weightKg} kg · Pickup {sh.pickupDate} · Status:{' '}
                      <span className="font-semibold text-emerald-700">{sh.status}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runSmartMatch(undefined, sh)}
                    className="px-3.5 py-1.5 border border-slate-300 text-xs font-semibold text-slate-800 rounded-lg hover:bg-slate-50 shrink-0"
                  >
                    Find Matches
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ECO IMPACT TAB */}
      {activeTab === 'impact' && <ImpactSection />}

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <form
          onSubmit={handleUpdateProfile}
          className="max-w-xl bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-lg font-display font-bold text-slate-950">Customer Profile</h2>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={profName}
              onChange={(e) => setProfName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 rounded-lg text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Mobile</label>
            <input
              type="text"
              disabled
              value={user?.mobile || ''}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 rounded-lg text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Address</label>
            <input
              type="text"
              required
              value={profAddress}
              onChange={(e) => setProfAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-950 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
          >
            Save Profile
          </button>
        </form>
      )}

      {/* BOOKING REVIEW MODAL */}
      {confirmMatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold text-slate-950">
                Review &amp; Confirm Booking
              </h3>
              <button
                type="button"
                onClick={() => setConfirmMatch(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-sm">
              <div className="font-semibold text-slate-950">
                {pickupLocation} → {deliveryLocation}
              </div>
              <div className="text-xs text-slate-600 tabular-nums">
                Date: {pickupDate} · Cargo: {goodsCategory} ({weightKg} kg)
              </div>
              <div className="text-xs text-slate-600">
                Vehicle: {confirmMatch.vehicle.modelName} ({confirmMatch.vehicle.registrationNumber})
              </div>
              <div className="text-xs text-slate-600">
                Driver: {confirmMatch.driverUser.fullName} · Match Score {confirmMatch.score}/100
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 tabular-nums border-t border-b border-slate-200 py-3">
              <div className="flex justify-between">
                <span>Base &amp; Distance Return Rate ({confirmMatch.shipmentDistanceKm} km)</span>
                <span>
                  ₹{(confirmMatch.fareBreakdown.baseComponent + confirmMatch.fareBreakdown.distanceComponent).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Weight &amp; Detour Fuel Adjustment (+{confirmMatch.detourKm} km)</span>
                <span>
                  ₹{(confirmMatch.fareBreakdown.weightSurcharge + confirmMatch.fareBreakdown.detourFuelSurcharge).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-950 pt-1">
                <span>Agreed Estimated Total</span>
                <span className="inline-flex items-center">
                  <IndianRupee className="w-3.5 h-3.5" />
                  {confirmMatch.estimatedFare.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmMatch(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bookingBusy}
                onClick={() => void handleConfirmBooking()}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{bookingBusy ? 'Submitting...' : 'Confirm Booking'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RATING & REVIEW MODAL */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitReview}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-display font-bold text-slate-950">
              Rate Delivery ({reviewBooking.bookingCode})
            </h3>
            <p className="text-xs text-slate-600">
              Driver: {reviewBooking.driver?.fullName} · {reviewBooking.pickupLocation} →{' '}
              {reviewBooking.deliveryLocation}
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Rating (1 to 5 Stars)
              </label>
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Very Good</option>
                <option value={3}>3 - Satisfactory</option>
                <option value={2}>2 - Needs Improvement</option>
                <option value={1}>1 - Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Review Comment</label>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share feedback on timeliness and cargo handling..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewBooking(null)}
                className="px-4 py-2 text-xs font-medium border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg"
              >
                Submit Review
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardShell>
  );
}
