import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { formatRupiah, getTodayDateString } from '../data/defaults';
import {
  Wallet,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  LogIn,
  LogOut,
  RefreshCw,
  Plus,
  ShieldCheck,
  ChevronDown,
  Receipt,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'receipts' | 'excel-table' | 'dashboard' | 'transactions' | 'bills';
  setActiveTab: (tab: 'receipts' | 'excel-table' | 'dashboard' | 'transactions' | 'bills') => void;
  onOpenAddModal: () => void;
  onOpenCategoryManager: () => void;
  onOpenExcelModal: () => void;
  onOpenClearModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddModal,
  onOpenCategoryManager,
  onOpenExcelModal,
  onOpenClearModal,
}) => {
  const { user, adminUser, isAuthenticated, isOnline, signOut } = useAuth();
  const { bills, isSyncing, summary, markBillAsPaid } = useFinance();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const todayStr = getTodayDateString();

  // Filter bills needing attention
  const attentionBills = bills.filter((b) => b.status === 'unpaid');

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => setActiveTab('receipts')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 via-orange-500 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-amber-600/20 group-hover:scale-105 transition-transform">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <span className="font-extrabold text-gray-900 text-base tracking-tight flex items-center gap-1.5">
                  AYAM @ <span className="text-amber-600">ANUGRAH</span>
                </span>
                <span className="text-[10px] text-gray-500 block font-semibold tracking-tight">
                  Data Harian Gudang & Struk Tagihan
                </span>
              </div>
            </div>

            {/* Sync Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>
                {isAuthenticated ? 'Multi-Device Cloud Sync' : 'Lokal / Gudang Siap'}
              </span>
              {isSyncing && <RefreshCw className="w-3 h-3 animate-spin text-emerald-600 ml-0.5" />}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-gray-100/80 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('receipts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'receipts'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Struk Gudang</span>
            </button>
            <button
              onClick={() => setActiveTab('excel-table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'excel-table'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Input Excel & AI</span>
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Arus Kas
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'transactions'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Riwayat Kas
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all relative ${
                activeTab === 'bills'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>Piutang & Tempo</span>
              {summary.pendingBillsCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-amber-500 text-white rounded-full">
                  {summary.pendingBillsCount}
                </span>
              )}
            </button>
          </nav>

          {/* Right Tools & Profile */}
          <div className="flex items-center gap-2">
            {onOpenClearModal && (
              <button
                onClick={onOpenClearModal}
                title="Hapus Rekap Keuangan"
                className="hidden sm:flex items-center gap-1 px-2.5 py-2 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl border border-rose-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Rekap</span>
              </button>
            )}

            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Catat Kas</span>
            </button>

            {/* Notification Bell with Badge */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                title="Notifikasi Pengingat Tagihan"
              >
                <Bell className="w-5 h-5" />
                {attentionBills.length > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-xs">
                    {attentionBills.length}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-gray-900">
                        Pengingat Tagihan Jatuh Tempo
                      </h4>
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400">
                      {attentionBills.length} tagihan belum dibayar
                    </span>
                  </div>

                  <div className="py-2 divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    {attentionBills.length === 0 ? (
                      <div className="py-6 text-center text-xs text-gray-400">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                        Hebat! Semua tagihan bulan ini sudah lunas.
                      </div>
                    ) : (
                      attentionBills.map((bill) => {
                        const isOverdue = bill.dueDate < todayStr;
                        const isToday = bill.dueDate === todayStr;

                        return (
                          <div key={bill.id} className="py-2.5 first:pt-1 last:pb-1 flex flex-col gap-1.5">
                            <div className="flex items-start justify-between">
                              <div>
                                <h5 className="text-xs font-bold text-gray-800">{bill.title}</h5>
                                <p className="text-[11px] font-mono font-semibold text-emerald-700">
                                  {formatRupiah(bill.amount)}
                                </p>
                              </div>
                              <span
                                className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                  isOverdue
                                    ? 'bg-rose-100 text-rose-800'
                                    : isToday
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-indigo-50 text-indigo-700'
                                }`}
                              >
                                {isOverdue ? 'Terlambat!' : isToday ? 'Hari Ini!' : `Jatuh Tempo: ${bill.dueDate}`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gray-400">{bill.category}</span>
                              <button
                                onClick={() => {
                                  markBillAsPaid(bill.id, true);
                                }}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-800 hover:underline"
                              >
                                Bayar & Catat
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setIsNotifOpen(false);
                        setActiveTab('bills');
                      }}
                      className="w-full py-1.5 text-center text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors"
                    >
                      Buka Semua Tagihan & Pengaturan →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Auth / Account Profile */}
            <div className="relative" ref={userMenuRef}>
              {isAuthenticated ? (
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-7 h-7 rounded-full border border-emerald-300 object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                      {adminUser ? 'A' : (user?.displayName || user?.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline text-xs font-bold text-gray-700 max-w-[100px] truncate">
                    {adminUser ? 'Admin' : (user?.displayName?.split(' ')[0] || 'Akun')}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>
              ) : (
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors"
                  title="Masuk akun admin"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Masuk Admin</span>
                </button>
              )}

              {/* User dropdown menu */}
              {isUserMenuOpen && isAuthenticated && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50">
                  <div className="pb-3 border-b border-gray-100">
                    <div className="font-bold text-xs text-gray-900 truncate">
                      {adminUser?.displayName || user?.displayName || 'Administrator Gudang'}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {adminUser ? 'Akun: admin (Hak Akses Penuh)' : user?.email}
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Sinkronisasi Multi-Device Aktif</span>
                    </div>
                  </div>

                  <div className="py-2 space-y-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenCategoryManager();
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded-lg"
                    >
                      Kategori Penjualan Ayam & Biaya
                    </button>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenExcelModal();
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded-lg"
                    >
                      Pusat Ekspor & Impor Excel
                    </button>
                    {onOpenClearModal && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenClearModal();
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium"
                      >
                        Hapus Rekap Keuangan
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar (Sign Out)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-gray-100">
          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-2 py-1 text-xs font-bold rounded-lg ${
              activeTab === 'receipts' ? 'bg-amber-100 text-amber-900 font-extrabold' : 'text-gray-500'
            }`}
          >
            Struk
          </button>
          <button
            onClick={() => setActiveTab('excel-table')}
            className={`px-2 py-1 text-xs font-bold rounded-lg ${
              activeTab === 'excel-table' ? 'bg-emerald-50 text-emerald-700 font-extrabold' : 'text-gray-500'
            }`}
          >
            Excel AI
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2 py-1 text-xs font-bold rounded-lg ${
              activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500'
            }`}
          >
            Arus Kas
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-2 py-1 text-xs font-bold rounded-lg ${
              activeTab === 'transactions' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500'
            }`}
          >
            Riwayat
          </button>
          <button
            onClick={() => setActiveTab('bills')}
            className={`px-2 py-1 text-xs font-bold rounded-lg relative ${
              activeTab === 'bills' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500'
            }`}
          >
            Piutang
            {summary.pendingBillsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[9px] bg-amber-500 text-white rounded-full font-bold">
                {summary.pendingBillsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
