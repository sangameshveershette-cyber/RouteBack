import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Users,
  Route as RouteIcon,
  Package,
  BarChart3,
  User as UserIcon,
  Plus,
  Edit3,
  Trash2,
  UserPlus,
  Upload,
  CheckCircle2,
  XCircle,
  Navigation,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardShell, type NavItem } from '../components/DashboardShell.tsx';
import { ImpactSection } from '../components/ImpactSection.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest, uploadFile } from '../lib/api.ts';
import type { Booking, ReturnTrip, Vehicle } from '../types.ts';

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'vehicles', label: 'Fleet Vehicles', icon: Truck },
  { id: 'drivers', label: 'Drivers & Activity', icon: Users },
  { id: 'trips', label: 'Return-Trip Feed', icon: RouteIcon },
  { id: 'bookings', label: 'Fleet Bookings', icon: Package },
  { id: 'analytics', label: 'Performance & Eco', icon: BarChart3 },
  { id: 'profile', label: 'Owner Profile', icon: UserIcon },
];

interface OwnerDriverRow {
  _id: string;
  userId: string;
  fullName: string;
  email: string;
  mobile: string;
  licenceNumber: string;
  experienceYears: number;
  address: string;
  ratingAvg: number;
  totalEarnings: number;
  belongsToCurrentOwner: boolean;
  assignedVehicle: {
    _id: string;
    registrationNumber: string;
    vehicleType: string;
    modelName: string;
  } | null;
}

const VEHICLE_TYPES = [
  'Tata Ace (Mini Truck)',
  'Mahindra Bolero Pickup',
  'Ashok Leyland Dost',
  'Tata 407 (LCV)',
  'Eicher Pro 14ft',
  'BharatBenz 17ft Container',
  'Heavy Duty 22ft Truck',
];

export function OwnerDashboard() {
  const { user, profile, refreshMe } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<OwnerDriverRow[]>([]);
  const [trips, setTrips] = useState<ReturnTrip[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'available' | 'occupied'>('all');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Add/Edit Vehicle Modal
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [regNumber, setRegNumber] = useState('');
  const [vType, setVType] = useState('Tata Ace (Mini Truck)');
  const [modelName, setModelName] = useState('');
  const [capacityKg, setCapacityKg] = useState('850');
  const [photoUrl, setPhotoUrl] = useState('');
  const [rcDoc, setRcDoc] = useState('');
  const [insDoc, setInsDoc] = useState('');
  const [uploadingAsset, setUploadingAsset] = useState(false);

  // Assign Driver Modal
  const [assignVehicle, setAssignVehicle] = useState<Vehicle | null>(null);
  const [assignMode, setAssignMode] = useState<'existing' | 'new'>('existing');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [newDrvName, setNewDrvName] = useState('');
  const [newDrvMobile, setNewDrvMobile] = useState('');
  const [newDrvEmail, setNewDrvEmail] = useState('');
  const [newDrvPassword, setNewDrvPassword] = useState('RouteBack@2026');
  const [newDrvLicence, setNewDrvLicence] = useState('');
  const [newDrvExp, setNewDrvExp] = useState('4');

  // Owner Profile
  const [ownerName, setOwnerName] = useState(String(profile?.ownerName || user?.fullName || ''));
  const [businessName, setBusinessName] = useState(String(profile?.businessName || ''));
  const [ownerAddress, setOwnerAddress] = useState(user?.address || '');

  const loadAll = useCallback(async () => {
    try {
      const [vRes, dRes, tRes, bRes] = await Promise.all([
        apiRequest<{ vehicles: Vehicle[] }>('/vehicles'),
        apiRequest<{ drivers: OwnerDriverRow[] }>('/vehicles/drivers'),
        apiRequest<{ trips: ReturnTrip[] }>('/return-trips'),
        apiRequest<{ bookings: Booking[] }>('/bookings'),
      ]);
      setVehicles(vRes.vehicles || []);
      setDrivers(dRes.drivers || []);
      setTrips(tRes.trips || []);
      setBookings(bRes.bookings || []);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to load fleet data.',
      });
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (user) setOwnerAddress(user.address);
    if (profile) {
      setOwnerName(String(profile.ownerName || user?.fullName || ''));
      setBusinessName(String(profile.businessName || ''));
    }
  }, [user, profile]);

  const totalVehicles = vehicles.length;
  const availableVehicles = vehicles.filter((v) => v.status === 'available').length;
  const occupiedVehicles = vehicles.filter((v) => v.status === 'occupied').length;
  const totalBookings = bookings.length;
  const computedOwnerEarnings = bookings
    .filter((b) => b.status === 'Delivered')
    .reduce((acc, b) => acc + Math.round(b.agreedFare * 0.23), 0);
  const totalEarnings = Math.max(Number(profile?.totalEarnings || 0), computedOwnerEarnings);

  const activeTripVehiclesCount = new Set([
    ...vehicles.filter((v) => v.status === 'occupied').map((v) => v._id),
    ...trips.filter((t) => ['booked', 'in_progress', 'completed'].includes(t.status)).map((t) => t.vehicleId),
  ]).size;
  const utilizationPct =
    totalVehicles > 0 ? Math.min(100, Math.round((activeTripVehiclesCount / totalVehicles) * 100)) : 0;

  const openAddVehicleModal = () => {
    setEditingVehicle(null);
    setRegNumber('');
    setVType('Tata Ace (Mini Truck)');
    setModelName('Tata Ace Gold Diesel');
    setCapacityKg('850');
    setPhotoUrl('');
    setRcDoc('');
    setInsDoc('');
    setVehicleModalOpen(true);
  };

  const openEditVehicleModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setRegNumber(v.registrationNumber);
    setVType(v.vehicleType);
    setModelName(v.modelName);
    setCapacityKg(String(v.capacityKg));
    setPhotoUrl(v.photos?.[0] || '');
    setRcDoc(v.rcDocument || '');
    setInsDoc(v.insuranceDocument || '');
    setVehicleModalOpen(true);
  };

  const handleAssetUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAsset(true);
    try {
      const res = await uploadFile(file);
      setter(res.url);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'File upload failed.',
      });
    } finally {
      setUploadingAsset(false);
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      if (editingVehicle) {
        await apiRequest(`/vehicles/${editingVehicle._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            vehicleType: vType,
            modelName,
            capacityKg: Number(capacityKg),
            photos: photoUrl ? [photoUrl] : undefined,
            rcDocument: rcDoc,
            insuranceDocument: insDoc,
          }),
        });
        setFeedback({ type: 'ok', text: `Vehicle ${editingVehicle.registrationNumber} updated.` });
      } else {
        await apiRequest('/vehicles', {
          method: 'POST',
          body: JSON.stringify({
            registrationNumber: regNumber,
            vehicleType: vType,
            modelName,
            capacityKg: Number(capacityKg),
            photos: photoUrl ? [photoUrl] : undefined,
            rcDocument: rcDoc,
            insuranceDocument: insDoc,
          }),
        });
        setFeedback({ type: 'ok', text: `Vehicle ${regNumber.toUpperCase()} added to your fleet.` });
      }
      setVehicleModalOpen(false);
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save vehicle.',
      });
    }
  };

  const handleDeleteVehicle = async (v: Vehicle) => {
    setFeedback(null);
    try {
      await apiRequest(`/vehicles/${v._id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', text: `Vehicle ${v.registrationNumber} deleted.` });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to delete vehicle.',
      });
    }
  };

  const handleAssignDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignVehicle) return;
    setFeedback(null);
    try {
      const payload =
        assignMode === 'existing'
          ? { driverId: selectedDriverId }
          : {
              createNewDriver: true,
              fullName: newDrvName,
              mobile: newDrvMobile,
              email: newDrvEmail,
              password: newDrvPassword,
              licenceNumber: newDrvLicence,
              experienceYears: Number(newDrvExp),
            };
      await apiRequest(`/vehicles/${assignVehicle._id}/assign-driver`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAssignVehicle(null);
      setNewDrvName('');
      setNewDrvMobile('');
      setNewDrvEmail('');
      setNewDrvLicence('');
      setFeedback({
        type: 'ok',
        text: `Driver assigned to ${assignVehicle.registrationNumber} successfully.`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to assign driver.',
      });
    }
  };

  const handleTripApproval = async (tripId: string, ownerApproved: boolean) => {
    try {
      await apiRequest(`/return-trips/${tripId}`, {
        method: 'PUT',
        body: JSON.stringify({ ownerApproved }),
      });
      setFeedback({
        type: 'ok',
        text: ownerApproved ? 'Return trip approved.' : 'Return trip rejected/cancelled.',
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update return trip.',
      });
    }
  };

  const handleBookingDecision = async (bookingId: string, accept: boolean) => {
    try {
      await apiRequest(`/bookings/${bookingId}/${accept ? 'accept' : 'reject'}`, {
        method: 'POST',
        body: accept ? undefined : JSON.stringify({ reason: 'Declined by vehicle owner' }),
      });
      setFeedback({
        type: 'ok',
        text: accept ? 'Booking confirmed for fleet vehicle.' : 'Booking rejected.',
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update booking.',
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ ownerName, businessName, address: ownerAddress, fullName: ownerName }),
      });
      await refreshMe();
      setFeedback({ type: 'ok', text: 'Vehicle owner profile updated.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update profile.',
      });
    }
  };

  const filteredVehicles = vehicles.filter((v) =>
    vehicleFilter === 'all' ? true : v.status === vehicleFilter
  );

  const vehiclePerfData = vehicles.map((v) => {
    const vBookings = bookings.filter((b) => b.vehicleId === v._id && b.status === 'Delivered');
    const revenue = vBookings.reduce((s, b) => s + b.agreedFare, 0);
    return {
      reg: v.registrationNumber,
      trips: trips.filter((t) => t.vehicleId === v._id).length,
      revenue,
    };
  });

  return (
    <DashboardShell
      roleLabel="Vehicle Owner Portal"
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
                {String(profile?.businessName || user?.fullName || 'Fleet Operations')}
              </h1>
              <p className="text-sm text-slate-600">
                Owner: {String(profile?.ownerName || user?.fullName)} · Multi-vehicle &amp; driver control center
              </p>
            </div>
            <button
              type="button"
              onClick={openAddVehicleModal}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Vehicle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Total Vehicles</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                {totalVehicles}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Available Vehicles</div>
              <div className="text-2xl font-display font-bold text-emerald-700 tabular-nums mt-1">
                {availableVehicles}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Vehicles On Trips</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                {occupiedVehicles}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Total Bookings</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                {totalBookings}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Owner Earnings</div>
              <div className="text-2xl font-display font-bold text-emerald-700 tabular-nums mt-1">
                ₹{totalEarnings.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Utilization Rate</div>
              <div className="text-2xl font-display font-bold text-slate-950 tabular-nums mt-1">
                {utilizationPct}%
              </div>
            </div>
          </div>

          {/* Fleet Quick Grid */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-display font-bold text-slate-950">Fleet Status</h2>
              <button
                type="button"
                onClick={() => setActiveTab('vehicles')}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Manage All Vehicles
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {vehicles.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No vehicles added yet. Click &ldquo;Add Vehicle&rdquo; to register your first truck.
                </div>
              ) : (
                vehicles.map((v) => (
                  <div
                    key={v._id}
                    className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-950">
                        {v.modelName} ({v.registrationNumber})
                      </div>
                      <div className="text-xs text-slate-600 tabular-nums">
                        {v.vehicleType} · {v.capacityKg} kg · Status:{' '}
                        <span
                          className={`font-semibold ${
                            v.status === 'available' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {v.status}
                        </span>{' '}
                        · Driver: {v.assignedDriver ? v.assignedDriver.fullName : 'Unassigned'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignVehicle(v);
                        setSelectedDriverId(v.assignedDriver?._id || drivers[0]?._id || '');
                      }}
                      className="px-3.5 py-1.5 border border-slate-300 text-xs font-semibold text-slate-800 rounded-lg hover:bg-slate-50 shrink-0"
                    >
                      {v.assignedDriver ? 'Change Driver' : 'Assign Driver'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* FLEET VEHICLES MANAGEMENT */}
      {activeTab === 'vehicles' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {(['all', 'available', 'occupied'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setVehicleFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize ${
                    vehicleFilter === f ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {f} ({f === 'all' ? vehicles.length : vehicles.filter((v) => v.status === f).length})
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openAddVehicleModal}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Vehicle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredVehicles.map((v) => (
              <div
                key={v._id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="h-44 bg-slate-100 relative overflow-hidden">
                  {v.photos?.[0] ? (
                    <img
                      src={v.photos[0]}
                      alt={v.modelName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Truck className="w-10 h-10 text-slate-400" />
                    </div>
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-700">
                        {v.registrationNumber}
                      </span>
                      <span
                        className={`font-semibold ${
                          v.status === 'available' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                    <h3 className="text-base font-display font-bold text-slate-950 mt-1">
                      {v.modelName}
                    </h3>
                    <div className="text-xs text-slate-600 mt-1 tabular-nums">
                      {v.vehicleType} · Capacity {v.capacityKg} kg
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Docs: {v.rcDocument || 'RC pending'} · {v.insuranceDocument || 'Insurance pending'}
                    </div>
                    <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      Assigned Driver:{' '}
                      <span className="font-semibold text-slate-900">
                        {v.assignedDriver
                          ? `${v.assignedDriver.fullName} (${v.assignedDriver.mobile})`
                          : 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setAssignVehicle(v);
                        setSelectedDriverId(v.assignedDriver?._id || drivers[0]?._id || '');
                      }}
                      className="px-3 py-1.5 bg-slate-950 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{v.assignedDriver ? 'Reassign Driver' : 'Assign Driver'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditVehicleModal(v)}
                      className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteVehicle(v)}
                      className="px-3 py-1.5 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1 ml-auto hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DRIVERS & ACTIVITY */}
      {activeTab === 'drivers' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-display font-bold text-slate-950">
              Registered Drivers &amp; Fleet Assignments
            </h2>
            <p className="text-xs text-slate-500">
              Assign drivers to vehicles under the Fleet Vehicles tab or view driver activity below
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Driver Name</th>
                  <th className="py-3 px-4 font-semibold">Contact &amp; Licence</th>
                  <th className="py-3 px-4 font-semibold">Assigned Vehicle</th>
                  <th className="py-3 px-4 font-semibold text-right">Rating</th>
                  <th className="py-3 px-4 font-semibold text-right">Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.map((d) => (
                  <tr key={d._id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-950">{d.fullName}</div>
                      <div className="text-slate-500">{d.belongsToCurrentOwner ? 'Your Fleet' : 'Network Driver'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-700">{d.mobile}</div>
                      <div className="text-slate-500">{d.licenceNumber}</div>
                    </td>
                    <td className="py-3 px-4">
                      {d.assignedVehicle ? (
                        <div>
                          <span className="font-semibold text-slate-900">
                            {d.assignedVehicle.registrationNumber}
                          </span>{' '}
                          <span className="text-slate-500">({d.assignedVehicle.modelName})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">{d.ratingAvg.toFixed(1)}/5</td>
                    <td className="py-3 px-4 text-right font-semibold tabular-nums">
                      ₹{d.totalEarnings.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RETURN TRIP FEED */}
      {activeTab === 'trips' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-display font-bold text-slate-950">
              Fleet Return-Trip Opportunities &amp; Approvals
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {trips.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                No return trips posted by your drivers yet.
              </div>
            ) : (
              trips.map((t) => (
                <div
                  key={t._id}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-950">
                      {t.currentLocation} → {t.returnDestination}
                    </div>
                    <div className="text-xs text-slate-600 tabular-nums">
                      Vehicle: {t.vehicle?.registrationNumber} · Driver: {t.driver?.fullName} ·{' '}
                      {t.availableCapacityKg} kg · {t.departureDate} · Status:{' '}
                      <span className="font-semibold text-emerald-700">{t.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-slate-950 tabular-nums mr-2">
                      ₹{t.expectedPrice.toLocaleString('en-IN')}
                    </span>
                    {t.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => void handleTripApproval(t._id, !t.ownerApproved)}
                        className="px-3 py-1.5 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50"
                      >
                        {t.ownerApproved ? 'Pause / Cancel' : 'Approve Trip'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* FLEET BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <h2 className="text-xl font-display font-bold text-slate-950">
            Fleet Bookings &amp; Trip Monitoring
          </h2>
          {bookings.length === 0 ? (
            <div className="p-8 rounded-xl bg-white border border-slate-200 text-center text-sm text-slate-500">
              No bookings recorded for your fleet yet.
            </div>
          ) : (
            bookings.map((bk) => (
              <div
                key={bk._id}
                className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="text-xs font-mono text-slate-500">
                    {bk.bookingCode} · {bk.vehicle?.registrationNumber} · Driver:{' '}
                    {bk.driver?.fullName}
                  </div>
                  <div className="font-bold text-base text-slate-950 mt-0.5">
                    {bk.pickupLocation} → {bk.deliveryLocation}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
                    Customer: {bk.customer?.fullName} · {bk.weightKg} kg · Status:{' '}
                    <span className="font-semibold text-emerald-700">{bk.status}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="font-bold text-sm text-slate-950 tabular-nums mr-2">
                    ₹{bk.agreedFare.toLocaleString('en-IN')}
                  </span>
                  {bk.status === 'Pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleBookingDecision(bk._id, true)}
                        className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleBookingDecision(bk._id, false)}
                        className="px-3 py-1.5 border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                  <Link
                    to={`/track/${bk.bookingCode}`}
                    className="px-3 py-1.5 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Track</span>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ANALYTICS & ECO */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-white border border-slate-200">
            <h3 className="text-base font-display font-bold text-slate-950 mb-4">
              Vehicle Performance &amp; Revenue (₹)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vehiclePerfData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="reg" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip />
                  <Bar dataKey="revenue" name="Gross Freight (₹)" fill="#0F172A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <ImpactSection compact />
        </div>
      )}

      {/* PROFILE */}
      {activeTab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="max-w-xl bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-lg font-display font-bold text-slate-950">Vehicle Owner Profile</h2>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Owner Name</label>
            <input
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Business Name (Optional)
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Address</label>
            <input
              type="text"
              required
              value={ownerAddress}
              onChange={(e) => setOwnerAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-950 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
          >
            Save Owner Profile
          </button>
        </form>
      )}

      {/* ADD / EDIT VEHICLE MODAL */}
      {vehicleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveVehicle}
            className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-display font-bold text-slate-950">
              {editingVehicle ? `Edit ${editingVehicle.registrationNumber}` : 'Add New Commercial Vehicle'}
            </h3>

            {!editingVehicle && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Vehicle Registration Number *
                </label>
                <input
                  type="text"
                  required
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="e.g., KA-09-TR-2026"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg uppercase"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Vehicle Type *
                </label>
                <select
                  value={vType}
                  onChange={(e) => setVType(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {VEHICLE_TYPES.map((vt) => (
                    <option key={vt} value={vt}>
                      {vt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Payload Capacity (kg) *
                </label>
                <input
                  type="number"
                  min="100"
                  required
                  value={capacityKg}
                  onChange={(e) => setCapacityKg(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Model Name *</label>
              <input
                type="text"
                required
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g., Tata Ace Gold Diesel"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="p-3 border border-dashed border-slate-300 rounded-lg cursor-pointer text-xs text-slate-600 hover:bg-slate-50 flex flex-col items-center gap-1 text-center">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>{photoUrl ? 'Photo Ready' : 'Vehicle Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleAssetUpload(e, setPhotoUrl)}
                  className="hidden"
                />
              </label>
              <label className="p-3 border border-dashed border-slate-300 rounded-lg cursor-pointer text-xs text-slate-600 hover:bg-slate-50 flex flex-col items-center gap-1 text-center">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>{rcDoc ? 'RC Attached' : 'RC Document'}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => void handleAssetUpload(e, setRcDoc)}
                  className="hidden"
                />
              </label>
              <label className="p-3 border border-dashed border-slate-300 rounded-lg cursor-pointer text-xs text-slate-600 hover:bg-slate-50 flex flex-col items-center gap-1 text-center">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>{insDoc ? 'Insurance Ready' : 'Insurance Doc'}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => void handleAssetUpload(e, setInsDoc)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVehicleModalOpen(false)}
                className="px-4 py-2 text-xs font-medium border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploadingAsset}
                className="px-5 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg"
              >
                {uploadingAsset ? 'Uploading...' : editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ASSIGN DRIVER MODAL */}
      {assignVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleAssignDriverSubmit}
            className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-display font-bold text-slate-950">
              Assign Driver to {assignVehicle.registrationNumber}
            </h3>

            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setAssignMode('existing')}
                className={`py-2 text-xs font-semibold rounded-md ${
                  assignMode === 'existing' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
                }`}
              >
                Select Existing Driver
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('new')}
                className={`py-2 text-xs font-semibold rounded-md ${
                  assignMode === 'new' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
                }`}
              >
                Register &amp; Assign New Driver
              </button>
            </div>

            {assignMode === 'existing' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Choose Registered Driver
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {drivers.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.fullName} ({d.mobile}) · {d.licenceNumber}
                      {d.assignedVehicle ? ` [Currently: ${d.assignedVehicle.registrationNumber}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  required
                  value={newDrvName}
                  onChange={(e) => setNewDrvName(e.target.value)}
                  placeholder="Driver Full Name *"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="tel"
                    required
                    value={newDrvMobile}
                    onChange={(e) => setNewDrvMobile(e.target.value)}
                    placeholder="Mobile Number *"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="email"
                    required
                    value={newDrvEmail}
                    onChange={(e) => setNewDrvEmail(e.target.value)}
                    placeholder="Email Address *"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={newDrvLicence}
                    onChange={(e) => setNewDrvLicence(e.target.value)}
                    placeholder="Driving Licence No. *"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg uppercase"
                  />
                  <input
                    type="number"
                    min="0"
                    required
                    value={newDrvExp}
                    onChange={(e) => setNewDrvExp(e.target.value)}
                    placeholder="Experience (yrs)"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newDrvPassword}
                  onChange={(e) => setNewDrvPassword(e.target.value)}
                  placeholder="Login Password (default: RouteBack@2026)"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignVehicle(null)}
                className="px-4 py-2 text-xs font-medium border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-slate-950 text-white rounded-lg"
              >
                Confirm Driver Assignment
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardShell>
  );
}
