import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Truck, Package, Building2, ArrowLeft, Upload, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { uploadFile } from '../lib/api.ts';
import type { UserRole } from '../types.ts';

interface AuthPageProps {
  mode: 'login' | 'register';
}

interface DemoAccountInfo {
  role: UserRole;
  label: string;
  email: string;
  mobile: string;
}

export function AuthPage({ mode }: AuthPageProps) {
  const { role: paramRole } = useParams<{ role?: string }>();
  const navigate = useNavigate();
  const { user, login, register } = useAuth();

  const initialRole: UserRole =
    paramRole === 'driver' || paramRole === 'owner' ? paramRole : 'customer';

  const [role, setRole] = useState<UserRole>(initialRole);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccountInfo[]>([]);
  const [demoPassword, setDemoPassword] = useState('RouteBack@2026');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registration form state
  const [fullName, setFullName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [experienceYears, setExperienceYears] = useState('3');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (paramRole === 'customer' || paramRole === 'driver' || paramRole === 'owner') {
      setRole(paramRole);
    }
  }, [paramRole]);

  useEffect(() => {
    if (user) {
      navigate(`/dashboard/${user.role}`, { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    fetch('/api/auth/demo-accounts')
      .then((r) => r.json())
      .then((d: { accounts?: DemoAccountInfo[]; passwordForAllDemoAccounts?: string }) => {
        if (d.accounts) setDemoAccounts(d.accounts);
        if (d.passwordForAllDemoAccounts) setDemoPassword(d.passwordForAllDemoAccounts);
      })
      .catch(() => {});
  }, []);

  const switchRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setError(null);
    navigate(`/${mode}/${nextRole}`, { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(identifier, loginPassword, role);
      navigate(`/dashboard/${loggedIn.role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async (acct: DemoAccountInfo) => {
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(acct.email, demoPassword, acct.role);
      navigate(`/dashboard/${loggedIn.role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      // Registration happens before JWT; convert small photo to local preview data URL or upload after auth
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setProfilePhoto(reader.result);
        }
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingPhoto(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (role === 'customer' && password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        role,
        fullName: role === 'owner' ? ownerName : fullName,
        ownerName: role === 'owner' ? ownerName : undefined,
        businessName: role === 'owner' ? businessName : undefined,
        mobile,
        email,
        password,
        confirmPassword: role === 'customer' ? confirmPassword : password,
        address,
        licenceNumber: role === 'driver' ? licenceNumber : undefined,
        experienceYears: role === 'driver' ? Number(experienceYears) : undefined,
        profilePhoto: role === 'driver' ? profilePhoto : undefined,
      };
      const created = await register(payload);
      navigate(`/dashboard/${created.role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleMeta: Record<UserRole, { title: string; subtitle: string; icon: typeof Package }> = {
    customer: {
      title: 'Customer Account',
      subtitle: 'Book return-trip goods transport and track shipments.',
      icon: Package,
    },
    driver: {
      title: 'Driver Account',
      subtitle: 'Post return trips on assigned vehicles and manage deliveries.',
      icon: Truck,
    },
    owner: {
      title: 'Vehicle Owner Account',
      subtitle: 'Manage fleet trucks, RC/insurance docs, and driver assignments.',
      icon: Building2,
    },
  };

  const RoleIcon = roleMeta[role].icon;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to RouteBack</span>
        </Link>
        <Link to="/" className="font-display font-bold text-lg text-slate-950">
          RouteBack
        </Link>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10">
        {/* Role Switcher */}
        <div className="mb-6">
          <p className="text-xs font-medium text-slate-500 mb-2">Select Account Portal</p>
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-200/70 rounded-xl">
            {(['customer', 'driver', 'owner'] as UserRole[]).map((r) => {
              const Icon = roleMeta[r].icon;
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => switchRole(r)}
                  className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>
                    {r === 'customer' ? 'Customer' : r === 'driver' ? 'Driver' : 'Vehicle Owner'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Auth Card */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <RoleIcon className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-slate-950">
                  {mode === 'login' ? `${roleMeta[role].title} Login` : `Register ${roleMeta[role].title}`}
                </h1>
                <p className="text-xs text-slate-600">{roleMeta[role].subtitle}</p>
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
                {error}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Email or Mobile Number
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g., customer@routeback.in or 9845033301"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-slate-950 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {submitting ? 'Signing in...' : `Sign in as ${role === 'owner' ? 'Vehicle Owner' : role}`}
                </button>

                <p className="text-xs text-slate-600 text-center pt-2">
                  Need a new {role === 'owner' ? 'vehicle owner' : role} account?{' '}
                  <Link
                    to={`/register/${role}`}
                    className="text-emerald-700 font-semibold hover:underline"
                  >
                    Create account
                  </Link>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                {role === 'owner' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Owner Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="e.g., Suresh Gowda"
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
                        placeholder="e.g., Kaveri Highway Freight Pvt Ltd"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                {role === 'driver' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Driving Licence Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={licenceNumber}
                        onChange={(e) => setLicenceNumber(e.target.value)}
                        placeholder="e.g., KA-09-20200012345"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Driving Experience (Years) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        required
                        value={experienceYears}
                        onChange={(e) => setExperienceYears(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, City, State"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                {role === 'driver' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Profile Photo (Optional)
                    </label>
                    <label className="flex items-center gap-3 px-3.5 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-xs text-slate-600">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>
                        {uploadingPhoto
                          ? 'Processing photo...'
                          : profilePhoto
                            ? 'Photo attached'
                            : 'Upload driver profile photo (JPG/PNG)'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => void handlePhotoUpload(e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                <div className={`grid grid-cols-1 ${role === 'customer' ? 'sm:grid-cols-2' : ''} gap-4`}>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Password * (min 6 chars)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  {role === 'customer' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {submitting ? 'Creating Account...' : 'Create Account & Enter Dashboard'}
                </button>

                <p className="text-xs text-slate-600 text-center pt-2">
                  Already registered?{' '}
                  <Link
                    to={`/login/${role}`}
                    className="text-slate-950 font-semibold hover:underline"
                  >
                    Sign in here
                  </Link>
                </p>
              </form>
            )}
          </div>

          {/* Development Demo Accounts Panel */}
          <div className="lg:col-span-5 bg-slate-950 text-white rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <KeyRound className="w-4 h-4" />
              <span>Development Demo Accounts</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Pre-seeded database accounts for Smart India Hackathon demonstration. All demo accounts use password{' '}
              <code className="font-mono bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300">
                {demoPassword}
              </code>
              .
            </p>

            <div className="space-y-3 pt-1">
              {demoAccounts.map((acct) => (
                <div
                  key={acct.email}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
                >
                  <div className="text-xs font-semibold text-white">{acct.label}</div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {acct.email} · {acct.mobile}
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleDemoSignIn(acct)}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Sign in as Demo {acct.role === 'owner' ? 'Vehicle Owner' : acct.role}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
