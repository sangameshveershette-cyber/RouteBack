import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  PlusCircle,
  Search,
  Package,
  IndianRupee,
  User as UserIcon,
  CheckCircle2,
  XCircle,
  Navigation,
  AlertCircle,
} from 'lucide-react';
import { DashboardShell, type NavItem } from '../components/DashboardShell.tsx';
import { LocationAutocompleteInput } from '../components/LocationAutocompleteInput.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type {
  Booking,
  BookingStatus,
  LatLng,
  ReturnTrip,
  ShipmentRequest,
  Vehicle,
} from '../types.ts';

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'post-trip', label: 'Post Return Trip', icon: PlusCircle },
  { id: 'matches', label: 'Shipment Matches', icon: Search },
  { id: 'bookings', label: 'Booking Requests', icon: Package },
  { id: 'earnings', label: 'Earnings & History', icon: IndianRupee },
  { id: 'profile', label: 'Driver Profile', icon: UserIcon },
];

export function DriverDashboard() {
  const { user, profile, assignedVehicle, refreshMe } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<ReturnTrip[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [openShipments, setOpenShipments] = useState<ShipmentRequest[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [tripOpportunities, setTripOpportunities] = useState<
    Array<{
      shipment: ShipmentRequest;
      customerName: string;
      score: number;
      detourKm: number;
      estimatedFare: number;
      explanation: string;
    }>
  >([]);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Post Return Trip state
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [currentLocation, setCurrentLocation] = useState('Mysuru');
  const [returnDestination, setReturnDestination] = useState('Bengaluru');
  const [currentCoords, setCurrentCoords] = useState<LatLng | undefined>({ lat: 12.2958, lng: 76.6394 });
  const [destinationCoords, setDestinationCoords] = useState<LatLng | undefined>({ lat: 12.9716, lng: 77.5946 });
  const [departureDate, setDepartureDate] = useState('2026-11-20');
  const [departureTime, setDepartureTime] = useState('09:30');
  const [availableCapacityKg, setAvailableCapacityKg] = useState('800');
  const [expectedPrice, setExpectedPrice] = useState('2100');
  const [fareHint, setFareHint] = useState<string | null>(null);
  const [postingTrip, setPostingTrip] = useState(false);

  // Driver Profile form
  const [profName, setProfName] = useState(user?.fullName || '');
  const [profAddress, setProfAddress] = useState(user?.address || '');
  const [profLicence, setProfLicence] = useState(String(profile?.licenceNumber || ''));
  const [profExp, setProfExp] = useState(String(profile?.experienceYears ?? 5));

  const loadAll = useCallback(async () => {
    try {
      const [vRes, tRes, bRes, sRes] = await Promise.all([
        apiRequest<{ vehicles: Vehicle[] }>('/vehicles'),
        apiRequest<{ trips: ReturnTrip[] }>('/return-trips'),
        apiRequest<{ bookings: Booking[] }>('/bookings'),
        apiRequest<{ shipments: ShipmentRequest[] }>('/shipments'),
      ]);
      const vList = vRes.vehicles || [];
      setVehicles(vList);
      if (vList.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vList[0]._id);
        setAvailableCapacityKg(String(Math.min(800, vList[0].capacityKg)));
      }
      const tList = tRes.trips || [];
      setTrips(tList);
      if (tList.length > 0 && !selectedTripId) {
        setSelectedTripId(tList[0]._id);
      }
      setBookings(bRes.bookings || []);
      setOpenShipments(sRes.shipments || []);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to load driver dashboard.',
      });
    }
  }, [selectedVehicleId, selectedTripId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (user) {
      setProfName(user.fullName);
      setProfAddress(user.address);
    }
    if (profile) {
      setProfLicence(String(profile.licenceNumber || ''));
      setProfExp(String(profile.experienceYears ?? 5));
    }
  }, [user, profile]);

  useEffect(() => {
    if (!selectedTripId) {
      setTripOpportunities([]);
      return;
    }
    apiRequest<{
      opportunities: typeof tripOpportunities;
    }>(`/matching/for-trip/${selectedTripId}`)
      .then((res) => setTripOpportunities(res.opportunities || []))
      .catch(() => setTripOpportunities([]));
  }, [selectedTripId]);

  const activeVehicle = vehicles[0] || assignedVehicle;
  const totalTripsCount = trips.length;
  const activeTripsCount = trips.filter((t) =>
    ['open', 'booked', 'in_progress'].includes(t.status)
  ).length;
  const completedBookingsCount = bookings.filter((b) => b.status === 'Delivered').length;
  const computedEarnings = bookings
    .filter((b) => b.status === 'Delivered')
    .reduce((sum, b) => sum + Math.round(b.agreedFare * 0.72), 0);
  const totalEarnings = Math.max(Number(profile?.totalEarnings || 0), computedEarnings);

  const previewFare = async () => {
    const chosenVeh = vehicles.find((v) => v._id === selectedVehicleId) || activeVehicle;
    try {
      const res = await apiRequest<{
        distanceKm: number;
        estimatedTotalFare: number;
        estimatedFuelCost: number;
      }>('/matching/fare-estimate', {
        method: 'POST',
        body: JSON.stringify({
          pickupLocation: currentLocation,
          deliveryLocation: returnDestination,
          weightKg: Number(availableCapacityKg) * 0.6,
          vehicleType: chosenVeh?.vehicleType || 'Tata Ace (Mini Truck)',
          detourKm: 0,
        }),
      });
      setExpectedPrice(String(res.estimatedTotalFare));
      setFareHint(
        `Suggested return-trip rate for ${res.distanceKm} km: ₹${res.estimatedTotalFare.toLocaleString('en-IN')} (est. fuel cost ₹${res.estimatedFuelCost.toLocaleString('en-IN')}).`
      );
    } catch {
      // ignore
    }
  };

  const handlePostReturnTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!selectedVehicleId && !activeVehicle) {
      setFeedback({
        type: 'err',
        text: 'You cannot post a return trip until a Vehicle Owner assigns a vehicle to you.',
      });
      return;
    }

    setPostingTrip(true);
    try {
      const chosenVeh = vehicles.find((v) => v._id === selectedVehicleId) || activeVehicle;
      const res = await apiRequest<{ trip: ReturnTrip }>('/return-trips', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: chosenVeh!._id,
          currentLocation,
          returnDestination,
          currentCoords,
          destinationCoords,
          departureDate,
          departureTime,
          availableCapacityKg: Number(availableCapacityKg),
          vehicleType: chosenVeh!.vehicleType,
          expectedPrice: Number(expectedPrice),
        }),
      });
      setTrips((prev) => [res.trip, ...prev]);
      setSelectedTripId(res.trip._id);
      setFeedback({
        type: 'ok',
        text: `Return trip ${currentLocation} → ${returnDestination} (${availableCapacityKg} kg) posted successfully.`,
      });
      setActiveTab('matches');
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to post return trip.',
      });
    } finally {
      setPostingTrip(false);
    }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    setFeedback(null);
    try {
      await apiRequest(`/bookings/${bookingId}/accept`, { method: 'POST' });
      setFeedback({
        type: 'ok',
        text: 'Booking accepted and confirmed! Customer contact details are now unlocked.',
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to accept booking.',
      });
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    setFeedback(null);
    try {
      await apiRequest(`/bookings/${bookingId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Route schedule conflict' }),
      });
      setFeedback({ type: 'ok', text: 'Booking declined.' });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to decline booking.',
      });
    }
  };

  const handleUpdateStatus = async (bookingId: string, status: BookingStatus) => {
    setFeedback(null);
    try {
      await apiRequest(`/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setFeedback({
        type: 'ok',
        text:
          status === 'Delivered'
            ? 'Delivery marked completed! Your earnings and vehicle availability have been updated.'
            : `Shipment status updated to ${status}.`,
      });
      await loadAll();
      await refreshMe();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update status.',
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: profName,
          address: profAddress,
          licenceNumber: profLicence,
          experienceYears: Number(profExp),
        }),
      });
      await refreshMe();
      setFeedback({ type: 'ok', text: 'Driver profile saved.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save profile.',
      });
    }
  };

  return (
    <DashboardShell
      roleLabel="Driver Portal"
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

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-950">
                Driver Operations · {user?.fullName}
              </h1>
              <p className="text-sm text-slate-600">
                Licence {String(profile?.licenceNumber || 'Pending')} ·{' '}
                {String(profile?.experienceYears ?? 0)} yrs experience · Rating{' '}
                <span className="tabular-nums">{Number(profile?.ratingAvg || 5).toFixed(1)}</span>/5
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('post-trip')}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Post Return Trip</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Total Trips</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                {totalTripsCount}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Active Trips</div>
              <div className="text-2xl font-display font-bold text-emerald-700 tabular-nums mt-1">
                {activeTripsCount}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Completed Trips</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                {completedBookingsCount}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Total Earnings</div>
              <div className="text-2xl font-display font-bold text-emerald-700 tabular-nums mt-1">
                ₹{totalEarnings.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Vehicle Max Capacity</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                {activeVehicle ? `${activeVehicle.capacityKg} kg` : 'Unassigned'}
              </div>
            </div>
          </div>

          {/* Assigned Vehicle Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
            <h2 className="text-base font-display font-bold text-slate-950 mb-4">
              Assigned Commercial Vehicle
            </h2>
            {activeVehicle ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    {activeVehicle.photos?.[0] ? (
                      <img
                        src={activeVehicle.photos[0]}
                        alt={activeVehicle.modelName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Truck className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-950">
                      {activeVehicle.modelName} ({activeVehicle.registrationNumber})
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
                      {activeVehicle.vehicleType} · Max Capacity {activeVehicle.capacityKg} kg · Status:{' '}
                      <span className="font-semibold text-emerald-700">{activeVehicle.status}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Owner: {activeVehicle.businessName || activeVehicle.ownerName || 'Assigned Fleet'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('post-trip')}
                  className="px-4 py-2 bg-slate-950 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 shrink-0"
                >
                  Post Return Trip with Vehicle
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3 text-sm text-amber-900">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">No Vehicle Currently Assigned</div>
                  <p className="text-xs mt-1">
                    Drivers can only post return trips using vehicles authorized and assigned by a Vehicle Owner.
                    Ask your Fleet Owner to assign a vehicle to <span className="font-mono">{user?.email}</span>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Pending Booking Requests */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-display font-bold text-slate-950">
                Booking Requests &amp; Active Runs
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('bookings')}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Manage All ({bookings.length})
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {bookings.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No booking requests received yet.</div>
              ) : (
                bookings.slice(0, 5).map((bk) => (
                  <div
                    key={bk._id}
                    className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-mono text-slate-500">
                        {bk.bookingCode} · {bk.pickupDate} · {bk.weightKg} kg
                      </div>
                      <div className="font-semibold text-sm text-slate-950">
                        {bk.pickupLocation} → {bk.deliveryLocation}
                      </div>
                      <div className="text-xs text-slate-600">
                        Status: <span className="font-semibold text-emerald-700">{bk.status}</span> ·
                        Customer: {bk.customer?.fullName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-sm text-slate-950 tabular-nums mr-2">
                        ₹{bk.agreedFare.toLocaleString('en-IN')}
                      </span>
                      {bk.status === 'Pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleAcceptBooking(bk._id)}
                            className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRejectBooking(bk._id)}
                            className="px-3 py-1.5 border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveTab('bookings')}
                          className="px-3 py-1.5 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg"
                        >
                          Update Trip
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* POST RETURN TRIP */}
      {activeTab === 'post-trip' && (
        <div className="max-w-3xl space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-lg font-display font-bold text-slate-950">Post a Return Trip</h2>
            <p className="text-xs text-slate-600 mt-1 mb-5">
              Only vehicles assigned to your driver account are authorized for return-trip postings.
            </p>

            {vehicles.length === 0 ? (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
                No assigned vehicle found. A Vehicle Owner must assign a truck to your account before you can post return trips.
              </div>
            ) : (
              <form onSubmit={handlePostReturnTrip} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Authorized Vehicle *
                  </label>
                  <select
                    value={selectedVehicleId || activeVehicle?._id || ''}
                    onChange={(e) => {
                      const v = vehicles.find((item) => item._id === e.target.value);
                      setSelectedVehicleId(e.target.value);
                      if (v) setAvailableCapacityKg(String(v.capacityKg));
                    }}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {vehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.modelName} ({v.registrationNumber}) · {v.vehicleType} · Max {v.capacityKg} kg
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <LocationAutocompleteInput
                    id="drv-from"
                    label="Current Location *"
                    value={currentLocation}
                    required
                    onChange={(val, coords) => {
                      setCurrentLocation(val);
                      setCurrentCoords(coords);
                    }}
                  />
                  <LocationAutocompleteInput
                    id="drv-to"
                    label="Return Destination *"
                    value={returnDestination}
                    required
                    onChange={(val, coords) => {
                      setReturnDestination(val);
                      setDestinationCoords(coords);
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Departure Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Departure Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Available Capacity (kg) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={activeVehicle?.capacityKg || 15000}
                      required
                      value={availableCapacityKg}
                      onChange={(e) => setAvailableCapacityKg(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Expected Price (₹) *
                    </label>
                    <input
                      type="number"
                      min="100"
                      required
                      value={expectedPrice}
                      onChange={(e) => setExpectedPrice(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                </div>

                {fareHint && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                    {fareHint}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => void previewFare()}
                    className="px-4 py-2.5 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50"
                  >
                    Estimate Suggested Return Fare
                  </button>
                  <button
                    type="submit"
                    disabled={postingTrip}
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg"
                  >
                    {postingTrip ? 'Posting Return Trip...' : 'Publish Return Trip'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SMART MATCHING LOAD OPPORTUNITIES */}
      {activeTab === 'matches' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-display font-bold text-slate-950">
                  Smart Matching Load Opportunities
                </h2>
                <p className="text-xs text-slate-600">
                  Shipment requests matched against your posted return trips
                </p>
              </div>
              {trips.length > 0 && (
                <select
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                >
                  {trips.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.currentLocation} → {t.returnDestination} ({t.departureDate} · {t.availableCapacityKg} kg · {t.status})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {tripOpportunities.length === 0 ? (
              <div className="p-6 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">
                No compatible open shipment requests found for this trip yet. Check all open shipment requests below.
              </div>
            ) : (
              <div className="space-y-3">
                {tripOpportunities.map((opp) => (
                  <div
                    key={opp.shipment._id}
                    className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs font-semibold text-emerald-700 tabular-nums">
                        {opp.score}/100 Smart Match · +{opp.detourKm} km detour
                      </div>
                      <div className="font-bold text-slate-950 mt-0.5">
                        {opp.shipment.pickupLocation} → {opp.shipment.deliveryLocation}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
                        {opp.shipment.goodsCategory} · {opp.shipment.weightKg} kg · Pickup{' '}
                        {opp.shipment.pickupDate} · Shipper: {opp.customerName}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{opp.explanation}</p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="text-lg font-bold text-slate-950">
                        ₹{opp.estimatedFare.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-500">Est. Shipment Fare</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Open Shipment Requests */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-display font-bold text-slate-950">
                All Open Customer Shipment Requests ({openShipments.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {openShipments.slice(0, 10).map((sh) => (
                <div key={sh._id} className="p-4 sm:px-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-sm text-slate-950">
                      {sh.pickupLocation} → {sh.deliveryLocation}
                    </div>
                    <div className="text-xs text-slate-600 tabular-nums">
                      {sh.goodsCategory} · {sh.weightKg} kg · Date {sh.pickupDate} · Preferred:{' '}
                      {sh.preferredVehicleType}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums shrink-0">
                    ~{sh.estimatedDistanceKm} km
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BOOKING REQUESTS & TRIP STATUS PROGRESSION */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <h2 className="text-xl font-display font-bold text-slate-950">
            Booking Requests &amp; Active Deliveries
          </h2>

          {bookings.length === 0 ? (
            <div className="p-8 rounded-xl bg-white border border-slate-200 text-center text-sm text-slate-500">
              No bookings assigned to you yet.
            </div>
          ) : (
            bookings.map((bk) => (
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
                      Customer: <span className="font-semibold">{bk.customer?.fullName}</span> · Contact:{' '}
                      <span className="font-mono">{bk.customer?.mobile}</span> · Address:{' '}
                      {bk.customer?.address}
                    </div>
                  </div>

                  <div className="text-right shrink-0 tabular-nums">
                    <div className="text-lg font-bold text-slate-950">
                      ₹{bk.agreedFare.toLocaleString('en-IN')}
                    </div>
                    <div className="text-xs font-semibold text-emerald-700">{bk.status}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                  {bk.status === 'Pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleAcceptBooking(bk._id)}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept Booking</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRejectBooking(bk._id)}
                        className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {bk.status === 'Confirmed' && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus(bk._id, 'Pickup Scheduled')}
                        className="px-3.5 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50"
                      >
                        Mark Pickup Scheduled
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus(bk._id, 'Picked Up')}
                        className="px-4 py-2 bg-slate-950 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
                      >
                        Mark Picked Up
                      </button>
                    </>
                  )}

                  {bk.status === 'Pickup Scheduled' && (
                    <button
                      type="button"
                      onClick={() => void handleUpdateStatus(bk._id, 'Picked Up')}
                      className="px-4 py-2 bg-slate-950 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
                    >
                      Mark Picked Up
                    </button>
                  )}

                  {bk.status === 'Picked Up' && (
                    <button
                      type="button"
                      onClick={() => void handleUpdateStatus(bk._id, 'In Transit')}
                      className="px-4 py-2 bg-slate-950 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
                    >
                      Mark In Transit
                    </button>
                  )}

                  {bk.status === 'In Transit' && (
                    <button
                      type="button"
                      onClick={() => void handleUpdateStatus(bk._id, 'Delivered')}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg"
                    >
                      Mark Delivered
                    </button>
                  )}

                  <Link
                    to={`/track/${bk.bookingCode}`}
                    className="px-3.5 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5 ml-auto"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Route &amp; Telemetry</span>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* EARNINGS & HISTORY */}
      {activeTab === 'earnings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Settled Driver Earnings (72% Share)</div>
              <div className="text-2xl font-display font-bold text-emerald-700 tabular-nums mt-1">
                ₹{totalEarnings.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Completed Deliveries</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                {completedBookingsCount}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Driver Rating</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                {Number(profile?.ratingAvg || 5).toFixed(1)} / 5.0
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-display font-bold text-slate-950">Trip History</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {trips.map((t) => (
                <div key={t._id} className="p-4 sm:px-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-sm text-slate-950">
                      {t.currentLocation} → {t.returnDestination}
                    </div>
                    <div className="text-xs text-slate-600 tabular-nums">
                      {t.departureDate} at {t.departureTime} · {t.availableCapacityKg} kg · Status:{' '}
                      <span className="font-semibold text-emerald-700">{t.status}</span>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-950 tabular-nums">
                    ₹{t.expectedPrice.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PROFILE */}
      {activeTab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="max-w-xl bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-lg font-display font-bold text-slate-950">Driver Profile</h2>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Licence Number
              </label>
              <input
                type="text"
                required
                value={profLicence}
                onChange={(e) => setProfLicence(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Experience (Years)
              </label>
              <input
                type="number"
                min="0"
                required
                value={profExp}
                onChange={(e) => setProfExp(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
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
            Save Driver Profile
          </button>
        </form>
      )}
    </DashboardShell>
  );
}
