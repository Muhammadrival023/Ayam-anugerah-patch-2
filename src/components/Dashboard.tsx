import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction, DateFilter } from '../types';
import { formatRupiah, getTodayDateString } from '../data/defaults';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  AlertCircle,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  Trash2,
  Clock,
} from 'lucide-react';

interface DashboardProps {
  onOpenAddModal: (type?: 'income' | 'expense') => void;
  onOpenExcelModal: () => void;
  onNavigateToBills: () => void;
  onNavigateToReceipts?: () => void;
  onOpenClearModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenAddModal,
  onOpenExcelModal,
  onNavigateToBills,
  onNavigateToReceipts,
  onOpenClearModal,
}) => {
  const { transactions, categories, bills, summary } = useFinance();

  const [dateFilter, setDateFilter] = useState<DateFilter['type']>('thisMonth');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Filter transactions based on selected date period
  const filteredTransactions = useMemo(() => {
    const today = new Date();
    const todayStr = getTodayDateString();

    return transactions.filter((t) => {
      if (dateFilter === 'all') return true;
      if (dateFilter === 'today') return t.date === todayStr;

      if (dateFilter === '7days') {
        const d = new Date(today);
        d.setDate(d.getDate() - 7);
        const sevenDaysAgo = d.toISOString().slice(0, 10);
        return t.date >= sevenDaysAgo && t.date <= todayStr;
      }

      if (dateFilter === 'thisMonth') {
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        return t.date.startsWith(`${year}-${month}`);
      }

      if (dateFilter === 'lastMonth') {
        const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return t.date.startsWith(`${year}-${month}`);
      }

      if (dateFilter === 'thisYear') {
        const year = today.getFullYear();
        return t.date.startsWith(`${year}`);
      }

      if (dateFilter === 'custom') {
        if (customStart && t.date < customStart) return false;
        if (customEnd && t.date > customEnd) return false;
        return true;
      }

      return true;
    });
  }, [transactions, dateFilter, customStart, customEnd]);

  // Periodic metrics
  const periodMetrics = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((t) => {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });

    const net = income - expense;
    const savingsRatio = income > 0 ? Math.max(0, Math.round(((income - expense) / income) * 100)) : 0;

    return { income, expense, net, savingsRatio };
  }, [filteredTransactions]);

  // Group expenses by category
  const categoryExpenses = useMemo(() => {
    const map: { [key: string]: { amount: number; color: string; count: number } } = {};
    let totalExpenseAmount = 0;

    filteredTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        totalExpenseAmount += t.amount;
        if (!map[t.category]) {
          const catInfo = categories.find((c) => c.name === t.category);
          map[t.category] = {
            amount: 0,
            color: catInfo?.color || '#94a3b8',
            count: 0,
          };
        }
        map[t.category].amount += t.amount;
        map[t.category].count += 1;
      });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        percentage: totalExpenseAmount > 0 ? Math.round((data.amount / totalExpenseAmount) * 100) : 0,
        color: data.color,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, categories]);

  // Group daily trend (last 7 or 14 points)
  const dailyTrends = useMemo(() => {
    const dateMap: { [date: string]: { income: number; expense: number } } = {};

    // Get sorted dates from filtered transactions
    filteredTransactions.forEach((t) => {
      if (!dateMap[t.date]) {
        dateMap[t.date] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') dateMap[t.date].income += t.amount;
      else dateMap[t.date].expense += t.amount;
    });

    const sortedDates = Object.keys(dateMap).sort();
    // take last 10 dates if many
    const slicedDates = sortedDates.slice(-10);

    return slicedDates.map((d) => ({
      date: d.slice(5), // MM-DD
      fullDate: d,
      income: dateMap[d].income,
      expense: dateMap[d].expense,
    }));
  }, [filteredTransactions]);

  const maxTrendValue = useMemo(() => {
    let max = 1;
    dailyTrends.forEach((d) => {
      if (d.income > max) max = d.income;
      if (d.expense > max) max = d.expense;
    });
    return max;
  }, [dailyTrends]);

  // Budget tracking for current month
  const budgetAlerts = useMemo(() => {
    const today = new Date();
    const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // calculate monthly expense per category
    const monthlySpending: { [category: string]: number } = {};
    transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(currentMonthPrefix))
      .forEach((t) => {
        monthlySpending[t.category] = (monthlySpending[t.category] || 0) + t.amount;
      });

    return categories
      .filter((c) => c.type === 'expense' && c.budget && c.budget > 0)
      .map((c) => {
        const spent = monthlySpending[c.name] || 0;
        const budget = c.budget || 0;
        const percent = Math.round((spent / budget) * 100);
        return {
          category: c.name,
          color: c.color,
          budget,
          spent,
          percent,
          isOver: spent > budget,
          isWarning: percent >= 80 && percent <= 100,
        };
      })
      .sort((a, b) => b.percent - a.percent);
  }, [transactions, categories]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white rounded-3xl p-6 lg:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="space-y-2 max-w-xl z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium backdrop-blur-xs text-amber-100">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
            <span>Sistem Arus Kas & Tagihan Ayam Anugerah</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
            Arus Kas & Pembayaran Ayam Anugerah
          </h1>
          <p className="text-emerald-100 text-sm leading-relaxed">
            Pantau arus kas harian distribusi karkas/ayam potong, piutang tempo mitra restoran, biaya operasional RPA, dan cetak faktur fisik.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 z-10">
          {onNavigateToReceipts && (
            <button
              onClick={onNavigateToReceipts}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
            >
              <Receipt className="w-4 h-4" />
              <span>Struk Harian Gudang</span>
            </button>
          )}

          <button
            onClick={() => onOpenAddModal('income')}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-500/80 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl backdrop-blur-xs transition-all active:scale-95 shadow-md shadow-emerald-950/20"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>+ Penjualan Ayam</span>
          </button>

          <button
            onClick={() => onOpenAddModal('expense')}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-500/90 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl backdrop-blur-xs transition-all active:scale-95 shadow-md shadow-rose-950/20"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>- Biaya Gudang</span>
          </button>

          <button
            onClick={onOpenExcelModal}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-semibold rounded-xl transition-all active:scale-95 shadow-md"
          >
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>Laporan Excel</span>
          </button>

          {onOpenClearModal && (
            <button
              onClick={onOpenClearModal}
              title="Hapus / Reset Rekap Keuangan"
              className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-900/60 hover:bg-rose-900 text-rose-200 hover:text-white text-xs font-medium rounded-xl border border-rose-500/30 transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Rekap</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Period Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium px-1">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>Periode Analisis:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari' },
              { id: 'thisMonth', label: 'Bulan Ini' },
              { id: 'lastMonth', label: 'Bulan Lalu' },
              { id: 'thisYear', label: 'Tahun Ini' },
              { id: 'all', label: 'Semua Data' },
              { id: 'custom', label: 'Kustom' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setDateFilter(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                dateFilter === item.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 w-full pt-2 border-t border-gray-100 sm:w-auto sm:pt-0 sm:border-t-0">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-700 focus:outline-emerald-500"
            />
            <span className="text-xs text-gray-400">s/d</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-700 focus:outline-emerald-500"
            />
          </div>
        )}
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Pemasukan
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xl lg:text-2xl font-extrabold text-emerald-700">
              {formatRupiah(periodMetrics.income)}
            </div>
            <p className="text-[11px] text-gray-500">
              {filteredTransactions.filter((t) => t.type === 'income').length} transaksi tercatat
            </p>
          </div>
        </div>

        {/* Total Expense */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Pengeluaran
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xl lg:text-2xl font-extrabold text-rose-600">
              {formatRupiah(periodMetrics.expense)}
            </div>
            <p className="text-[11px] text-gray-500">
              {filteredTransactions.filter((t) => t.type === 'expense').length} transaksi tercatat
            </p>
          </div>
        </div>

        {/* Net Balance */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Arus Kas Bersih
            </span>
            <div
              className={`p-2 rounded-xl ${
                periodMetrics.net >= 0 ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div
              className={`text-xl lg:text-2xl font-extrabold ${
                periodMetrics.net >= 0 ? 'text-teal-700' : 'text-amber-600'
              }`}
            >
              {formatRupiah(periodMetrics.net)}
            </div>
            <p className="text-[11px] text-gray-500">
              {periodMetrics.net >= 0 ? 'Surplus / Saldo Aman' : 'Defisit pada periode ini'}
            </p>
          </div>
        </div>

        {/* Poultry Receivables / Unpaid Customer Dues */}
        <div
          onClick={onNavigateToBills}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Piutang Pelanggan (Tempo)
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xl lg:text-2xl font-extrabold text-amber-900">
              {formatRupiah(summary.pendingBillsAmount)}
            </div>
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              {summary.pendingBillsCount > 0 ? (
                <span className="text-amber-600 font-semibold">
                  {summary.pendingBillsCount} nota pengiriman belum lunas
                </span>
              ) : (
                <span className="text-emerald-600 font-medium">Semua nota pelanggan lunas!</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cashflow Trends (2 cols on desktop) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Tren Arus Kas (Pemasukan vs Pengeluaran)</h3>
                <p className="text-xs text-gray-500">Aktivitas keuangan dalam rentang terpilih</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-gray-600">Pemasukan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-gray-600">Pengeluaran</span>
              </div>
            </div>
          </div>

          {dailyTrends.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <BarChart3 className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-xs font-semibold text-gray-600">Belum Ada Transaksi di Periode Ini</p>
              <p className="text-[11px] text-gray-400 mt-1">Tambahkan transaksi harian untuk melihat grafik tren visual.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-56 flex items-end gap-3 sm:gap-6 pt-4 pb-2 px-2 border-b border-gray-100 overflow-x-auto">
                {dailyTrends.map((d, i) => {
                  const incomeHeight = Math.max(8, Math.round((d.income / maxTrendValue) * 160));
                  const expenseHeight = Math.max(8, Math.round((d.expense / maxTrendValue) * 160));

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center min-w-[36px] group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] rounded-lg py-1 px-2 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                        <div className="font-bold">{d.fullDate}</div>
                        <div className="text-emerald-300">+ {formatRupiah(d.income)}</div>
                        <div className="text-rose-300">- {formatRupiah(d.expense)}</div>
                      </div>

                      {/* Dual Bars */}
                      <div className="flex items-end gap-1 w-full justify-center">
                        <div
                          style={{ height: `${incomeHeight}px` }}
                          className="w-2.5 sm:w-3.5 bg-emerald-500 rounded-t-sm hover:bg-emerald-600 transition-colors"
                        />
                        <div
                          style={{ height: `${expenseHeight}px` }}
                          className="w-2.5 sm:w-3.5 bg-rose-500 rounded-t-sm hover:bg-rose-600 transition-colors"
                        />
                      </div>

                      <span className="text-[10px] text-gray-400 mt-2 font-mono">{d.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Expense Category Breakdown (Donut & Ranking) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <PieIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Distribusi Kategori</h3>
                  <p className="text-xs text-gray-500">Komposisi pengeluaran</p>
                </div>
              </div>
            </div>

            {categoryExpenses.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <PieIcon className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs text-gray-500">Tidak ada pengeluaran di periode ini</p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {categoryExpenses.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2 truncate max-w-[170px]">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-gray-800 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{formatRupiah(item.amount)}</span>
                        <span className="text-[10px] text-gray-400 font-mono">({item.percentage}%)</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100 mt-4">
            <button
              onClick={() => onOpenAddModal('expense')}
              className="w-full py-2 px-3 text-xs font-medium text-center text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
            >
              + Catat Pengeluaran Baru
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Budget Compliance Warnings */}
      {budgetAlerts.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Kontrol Batas Anggaran (Budget Bulanan)</h3>
                <p className="text-xs text-gray-500">Pemantauan real-time pengeluaran vs target bulan ini</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgetAlerts.map((b, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border transition-all ${
                  b.isOver
                    ? 'border-rose-200 bg-rose-50/40'
                    : b.isWarning
                    ? 'border-amber-200 bg-amber-50/40'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-800 text-xs">{b.category}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      b.isOver
                        ? 'bg-rose-100 text-rose-800'
                        : b.isWarning
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {b.isOver ? 'Overbudget!' : `${b.percent}%`}
                  </span>
                </div>

                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      b.isOver ? 'bg-rose-600' : b.isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, b.percent)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-gray-500">
                  <span>Terpakai: {formatRupiah(b.spent)}</span>
                  <span>Batas: {formatRupiah(b.budget)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
