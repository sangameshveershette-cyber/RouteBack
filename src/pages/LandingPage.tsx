import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck,
  Package,
  Building2,
  ArrowRight,
  Route as RouteIcon,
  ShieldCheck,
  Leaf,
  TrendingUp,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { ImpactSection } from '../components/ImpactSection.tsx';
import type { EnvironmentalImpactReport, PlatformStats } from '../types.ts';

const HERO_IMG = '/src/assets/images/hero_freight_highway_1794637557748.jpg';
const ABOUT_IMG = '/src/assets/images/about_logistics_hub_1794637558440.jpg';

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [impact, setImpact] = useState<EnvironmentalImpactReport | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    role: 'Customer',
    message: '',
  });
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    fetch('/api/impact')
      .then((r) => r.json())
      .then((data: { impact?: EnvironmentalImpactReport; platformStats?: PlatformStats }) => {
        if (data.impact) setImpact(data.impact);
        if (data.platformStats) setStats(data.platformStats);
      })
      .catch(() => {});
  }, []);

  const dashboardPath =
    user?.role === 'driver'
      ? '/dashboard/driver'
      : user?.role === 'owner'
        ? '/dashboard/owner'
        : '/dashboard/customer';

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) return;
    setContactSent(true);
    setContactForm({ name: '', email: '', role: 'Customer', message: '' });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Three-Zone Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="text-xl font-display font-extrabold tracking-tight text-slate-950 whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <Truck className="w-5 h-5 text-emerald-600" />
            <span>RouteBack</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#about" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              About
            </a>
            <a href="#how-it-works" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#portals" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              Account Portals
            </a>
            <a href="#impact" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              Impact
            </a>
            <a href="#contact" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              Contact
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => navigate(dashboardPath)}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Open Dashboard
              </button>
            ) : (
              <Link
                to="/login/customer"
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Login / Register
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenu((p) => !p)}
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
            aria-label="Toggle Menu"
          >
            {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenu && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
            <div className="flex flex-col space-y-2 text-sm font-medium text-slate-700">
              <a href="#about" onClick={() => setMobileMenu(false)} className="py-1.5">About</a>
              <a href="#how-it-works" onClick={() => setMobileMenu(false)} className="py-1.5">How It Works</a>
              <a href="#portals" onClick={() => setMobileMenu(false)} className="py-1.5">Account Portals</a>
              <a href="#impact" onClick={() => setMobileMenu(false)} className="py-1.5">Impact</a>
              <a href="#contact" onClick={() => setMobileMenu(false)} className="py-1.5">Contact</a>
            </div>
            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <Link
                to={user ? dashboardPath : '/login/customer'}
                className="flex-1 text-center py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg"
              >
                {user ? 'Open Dashboard' : 'Login'}
              </Link>
              {!user && (
                <Link
                  to="/register/customer"
                  className="flex-1 text-center py-2.5 text-sm font-semibold text-slate-900 border border-slate-300 rounded-lg"
                >
                  Register
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative bg-slate-950 text-white overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={HERO_IMG}
            alt="Commercial goods truck traveling on Indian expressway at golden hour"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/88 to-slate-950/60" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-28">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-emerald-400 tracking-wide mb-3">
              Smart Return-Trip Goods Transportation Platform · India Freight Network
            </p>
            <h1 className="font-display font-extrabold text-white tracking-tight leading-[1.08] text-[clamp(2.25rem,4.5vw,3.75rem)]">
              Never Return Empty. Earn More on Every Trip.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
              Connect empty return journeys with real shipment opportunities. Save fuel,
              increase earnings and make transportation smarter.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate(user?.role === 'customer' ? '/dashboard/customer' : '/login/customer')
                }
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Package className="w-4 h-4" />
                <span>Find Transport</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(user?.role === 'driver' ? '/dashboard/driver' : '/login/driver')
                }
                className="px-6 py-3 bg-white text-slate-950 hover:bg-slate-100 font-semibold text-sm rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Truck className="w-4 h-4" />
                <span>Post Return Trip</span>
              </button>

              <Link
                to="/login/customer"
                className="px-5 py-3 border border-slate-600 text-slate-200 hover:bg-slate-900 font-medium text-sm rounded-lg transition-colors whitespace-nowrap"
              >
                Login
              </Link>
              <Link
                to="/register/customer"
                className="px-5 py-3 border border-slate-600 text-slate-200 hover:bg-slate-900 font-medium text-sm rounded-lg transition-colors whitespace-nowrap"
              >
                Register
              </Link>
            </div>
          </div>

          {/* Three Separate Account Portals Bar */}
          <div id="portals" className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-xl bg-white text-slate-900 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-emerald-700">01 · Shippers &amp; Businesses</span>
                  <Package className="w-5 h-5 text-slate-800" />
                </div>
                <h2 className="text-lg font-display font-bold text-slate-950">Customer Portal</h2>
                <p className="text-sm text-slate-600 mt-1.5">
                  Post shipment loads, compare smart-matched return vehicles, view route maps, and track deliveries.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                <Link
                  to="/login/customer"
                  className="flex-1 text-center py-2 px-3 bg-slate-950 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 whitespace-nowrap"
                >
                  Customer Login
                </Link>
                <Link
                  to="/register/customer"
                  className="flex-1 text-center py-2 px-3 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 whitespace-nowrap"
                >
                  Register
                </Link>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-white text-slate-900 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-emerald-700">02 · Commercial Operators</span>
                  <Truck className="w-5 h-5 text-slate-800" />
                </div>
                <h2 className="text-lg font-display font-bold text-slate-950">Driver Portal</h2>
                <p className="text-sm text-slate-600 mt-1.5">
                  Post return journeys using your assigned vehicle, accept matched cargo requests, and boost trip earnings.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                <Link
                  to="/login/driver"
                  className="flex-1 text-center py-2 px-3 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 whitespace-nowrap"
                >
                  Driver Login
                </Link>
                <Link
                  to="/register/driver"
                  className="flex-1 text-center py-2 px-3 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 whitespace-nowrap"
                >
                  Register
                </Link>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-white text-slate-900 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-emerald-700">03 · Fleet Managers</span>
                  <Building2 className="w-5 h-5 text-slate-800" />
                </div>
                <h2 className="text-lg font-display font-bold text-slate-950">Vehicle Owner Portal</h2>
                <p className="text-sm text-slate-600 mt-1.5">
                  Manage multi-vehicle fleets, upload RC &amp; insurance docs, assign drivers, and monitor utilization.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                <Link
                  to="/login/owner"
                  className="flex-1 text-center py-2 px-3 bg-slate-950 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 whitespace-nowrap"
                >
                  Vehicle Owner Login
                </Link>
                <Link
                  to="/register/owner"
                  className="flex-1 text-center py-2 px-3 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 whitespace-nowrap"
                >
                  Register
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Platform Statistics */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div>
            <div className="text-2xl font-display font-bold text-slate-950 tabular-nums">
              {stats ? stats.openReturnTrips : 20}
            </div>
            <div className="text-xs text-slate-600 mt-1">Open Return Trips</div>
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-slate-950 tabular-nums">
              {stats ? stats.totalVehicles : 15}
            </div>
            <div className="text-xs text-slate-600 mt-1">Registered Vehicles</div>
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-slate-950 tabular-nums">
              {stats ? stats.totalDrivers : 10}
            </div>
            <div className="text-xs text-slate-600 mt-1">Verified Drivers</div>
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-slate-950 tabular-nums">
              {stats ? stats.totalVehicleOwners : 5}
            </div>
            <div className="text-xs text-slate-600 mt-1">Fleet Owners</div>
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-slate-950 tabular-nums">
              {stats ? stats.totalCustomers : 15}
            </div>
            <div className="text-xs text-slate-600 mt-1">Shipper Accounts</div>
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-emerald-700 tabular-nums">
              {impact ? `${impact.emptyKmAvoided.toLocaleString('en-IN')} km` : '780+ km'}
            </div>
            <div className="text-xs text-slate-600 mt-1">Empty km Avoided (Est.)</div>
          </div>
        </div>
      </section>

      {/* About RouteBack + Problem & Solution */}
      <section id="about" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-semibold text-emerald-700 mb-2">About RouteBack</p>
              <h2 className="text-3xl font-display font-bold text-slate-950 tracking-tight">
                Eliminating empty commercial return legs across Indian highway corridors
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                After completing outbound deliveries between industrial hubs like Bengaluru, Mysuru,
                Chennai, Hyderabad, Pune, and Mangaluru, thousands of trucks travel back empty.
                RouteBack turns wasted deadhead kilometres into affordable shipping capacity and extra revenue.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-200">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950 mb-2">The Problem We Solve</h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li>Fuel wasted on empty backhaul runs</li>
                    <li>Drivers lose return-journey income</li>
                    <li>SMEs overpay for small &amp; medium cargo</li>
                    <li>Low fleet utilization &amp; higher CO2 output</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-emerald-800 mb-2">The RouteBack Solution</h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li>Weighted route &amp; capacity matching engine</li>
                    <li>Owner-authorized driver trip posting</li>
                    <li>Transparent distance &amp; weight fare estimates</li>
                    <li>End-to-end status &amp; simulated GPS tracking</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[320px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={ABOUT_IMG}
                  alt="Cargo pallets loaded onto commercial vehicle at logistics bay"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 sm:py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold text-emerald-700 mb-2">How It Works</p>
            <h2 className="text-3xl font-display font-bold text-slate-950 tracking-tight">
              Connected workflow across Fleet Owners, Drivers, and Customers
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '01. Assign Fleet',
                title: 'Owner Registers & Assigns',
                desc: 'Vehicle owners register commercial trucks, upload RC/insurance documents, and assign authorized drivers.',
                icon: Building2,
              },
              {
                num: '02. Post Return Leg',
                title: 'Driver Posts Return Trip',
                desc: 'Before returning empty, the driver enters origin, destination, departure time, available kg capacity, and expected fare.',
                icon: Truck,
              },
              {
                num: '03. Smart Matching',
                title: 'Weighted Score Ranking',
                desc: 'Our algorithm scores Route (40%), Capacity (25%), Time (20%), and Detour (15%) to surface the strongest vehicles.',
                icon: RouteIcon,
              },
              {
                num: '04. Book & Deliver',
                title: 'Confirm, Track & Settle',
                desc: 'Customer books, driver accepts, goods move from Picked Up to Delivered, and earnings & CO2 impact update automatically.',
                icon: CheckCircle2,
              },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="p-6 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-emerald-700">{step.num}</span>
                    <Icon className="w-5 h-5 text-slate-800" />
                  </div>
                  <h3 className="text-base font-display font-bold text-slate-950">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Role Benefits */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/70">
              <TrendingUp className="w-5 h-5 text-emerald-700 mb-3" />
              <h3 className="text-lg font-display font-bold text-slate-950">Benefits for Drivers</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Monetize empty return kilometres effortlessly</li>
                <li>Receive matched shipment alerts along your exact highway route</li>
                <li>Clear customer contact details after booking confirmation</li>
                <li>Track cumulative trip earnings and ratings in one dashboard</li>
              </ul>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/70">
              <Package className="w-5 h-5 text-emerald-700 mb-3" />
              <h3 className="text-lg font-display font-bold text-slate-950">Benefits for Customers</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Access verified return trucks suited for 100 kg to 10,000+ kg loads</li>
                <li>Compare transparent match scores, detours, and estimated fares</li>
                <li>View route maps before booking and cancel eligible pending trips</li>
                <li>Monitor shipment milestones from Pickup Scheduled to Delivered</li>
              </ul>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/70">
              <ShieldCheck className="w-5 h-5 text-emerald-700 mb-3" />
              <h3 className="text-lg font-display font-bold text-slate-950">Benefits for Vehicle Owners</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Manage multiple trucks, RC/insurance docs, and driver assignments</li>
                <li>Drivers can only post trips on vehicles you authorize</li>
                <li>Real-time fleet occupancy, revenue share, and utilization metrics</li>
                <li>Approve, monitor, or reject return-trip requests anytime</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Environmental Impact Section */}
      <section id="impact" className="py-16 sm:py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5" />
                <span>Environmental Impact Calculator</span>
              </p>
              <h2 className="text-3xl font-display font-bold text-slate-950 tracking-tight">
                Measurable reduction in empty freight runs
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Every matched return trip helps reduce deadhead diesel burn. Figures below are dynamically calculated estimates from database bookings.
              </p>
            </div>
          </div>

          <ImpactSection initialImpact={impact} />
        </div>
      </section>

      {/* Contact Us */}
      <section id="contact" className="py-16 sm:py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-4">
            <p className="text-xs font-semibold text-emerald-700">Contact RouteBack</p>
            <h2 className="text-3xl font-display font-bold text-slate-950 tracking-tight">
              Partner with our logistics engineering team
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Onboarding a commercial fleet, testing corridor APIs, or evaluating RouteBack for Smart India Hackathon? Reach out directly.
            </p>
            <div className="pt-4 space-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Bengaluru Logistics Tech Hub, Karnataka, India</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>support@routeback.in</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>+91 80 4120 8890</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <form
              onSubmit={handleContactSubmit}
              className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-slate-50 space-y-4"
            >
              {contactSent && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
                  Thank you. Your inquiry has been recorded by the RouteBack operations desk.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Your Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    placeholder="Full name"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="you@company.in"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Account Type</label>
                <select
                  value={contactForm.role}
                  onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option>Customer / Shipper</option>
                  <option>Commercial Driver</option>
                  <option>Vehicle Owner / Fleet</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Message</label>
                <textarea
                  rows={3}
                  required
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Tell us about your transport corridor or fleet size..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-950 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 inline-flex items-center gap-2"
              >
                <span>Send Message</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="text-white font-display font-bold text-base">RouteBack</div>
            <p className="text-xs text-slate-400 mt-1">
              Never Return Empty. Earn More on Every Trip. · Smart India Hackathon Prototype
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <Link to="/login/customer" className="hover:text-white">Customer Login</Link>
            <Link to="/login/driver" className="hover:text-white">Driver Login</Link>
            <Link to="/login/owner" className="hover:text-white">Vehicle Owner Login</Link>
            <Link to="/track/RB-2026-1043" className="hover:text-white">Track Shipment</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
