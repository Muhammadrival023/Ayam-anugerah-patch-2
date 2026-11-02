import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Receipt,
  FileSpreadsheet,
  RefreshCw,
  Server,
} from 'lucide-react';

interface LoginDashboardProps {
  onLoginSuccess?: () => void;
}

export const LoginDashboard: React.FC<LoginDashboardProps> = ({ onLoginSuccess }) => {
  const { loginWithCredentials, isOnline, signInWithGoogle } = useAuth();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successAnimation, setSuccessAnimation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const result = await loginWithCredentials(username, password, rememberMe);
      if (result.success) {
        setSuccessAnimation(true);
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess();
        }, 600);
      } else {
        setErrorMessage(result.error || 'Akun atau kata sandi tidak valid.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat masuk.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = () => {
    setUsername('admin');
    setPassword('admin123');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-950/40 to-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 selection:bg-amber-500 selection:text-white">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md my-auto">
        {/* Top Brand Banner */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-wide shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>SISTEM GUDANG & KAS AYAM @ ANUGERAH</span>
          </div>

          <div className="flex items-center justify-center gap-3 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-emerald-500 flex items-center justify-center text-white shadow-xl shadow-amber-500/25">
              <Receipt className="w-7 h-7" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
                AYAM @ <span className="text-amber-400">ANUGRAH</span>
              </h1>
              <p className="text-[11px] font-semibold text-gray-400 mt-0.5 tracking-tight">
                Data Harian Gudang & Pembukuan Arus Kas
              </p>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 space-y-6">
          <div className="space-y-1 text-center sm:text-left border-b border-gray-100 pb-4">
            <h2 className="text-lg font-extrabold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Login Dashboard Admin</span>
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Masuk untuk mengelola data tagihan, struk kasir thermal, input Excel, dan pembukuan kas.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Success Banner */}
          {successAnimation && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Login berhasil! Membuka data gudang...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                <span>Nama Akun / Username</span>
                <span className="text-[11px] font-mono text-amber-700 font-normal">Akun: admin</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ketik admin"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                <span>Kata Sandi / Password</span>
                <span className="text-[11px] font-mono text-amber-700 font-normal">Password: admin123</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ketik admin123"
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Quick Autofill */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-900 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span className="text-[11px] font-medium">Ingat saya di perangkat ini</span>
              </label>

              <button
                type="button"
                onClick={handleQuickFill}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1"
                title="Isi form otomatis dengan akun admin"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Isi Otomatis</span>
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || successAnimation}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-amber-600/30 hover:shadow-amber-600/40 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard Gudang</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Multi-Device Cloud Sync Notice */}
          <div className="pt-2 border-t border-gray-100">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Server className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Sinkronisasi Multi-Device</span>
                </div>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {isOnline ? 'Cloud Firestore Siap' : 'Mode Offline'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Data struk dan pembukuan dapat diakses langsung dari <strong>berbagai perangkat</strong> (HP, Tablet, Laptop) secara real-time menggunakan akun ini.
              </p>

              <div className="flex items-center justify-center gap-4 pt-1 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                  <span>HP Android/iOS</span>
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1">
                  <Laptop className="w-3.5 h-3.5 text-blue-600" />
                  <span>PC / Laptop Gudang</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-400 space-y-1">
          <p className="font-medium">Ayam @ Anugerah &bull; Data Harian Gudang</p>
          <p className="text-[10px] text-slate-500">
            Akun Default: <strong>admin</strong> | Kata Sandi: <strong>admin123</strong>
          </p>
        </div>
      </div>
    </div>
  );
};
