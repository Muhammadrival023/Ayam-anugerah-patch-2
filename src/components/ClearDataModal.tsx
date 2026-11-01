import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatRupiah, getTodayDateString } from '../data/defaults';
import {
  Trash2,
  AlertTriangle,
  X,
  CheckCircle,
  Calendar,
  Layers,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({ isOpen, onClose }) => {
  const { transactions, bills, deleteTransactionsByPeriod, clearAllFinancialData, clearReceipts } = useFinance();

  const [mode, setMode] = useState<'period' | 'all_txns' | 'all_data'>('period');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [confirmInput, setConfirmInput] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [resultMsg, setResultMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Count items matching the period mode
  const periodCount = useMemo(() => {
    if (mode !== 'period') return 0;
    return transactions.filter((t) => {
      if (customStart || customEnd) {
        if (customStart && t.date < customStart) return false;
        if (customEnd && t.date > customEnd) return false;
        return true;
      }
      return t.date.startsWith(selectedMonth);
    }).length;
  }, [transactions, mode, selectedMonth, customStart, customEnd]);

  if (!isOpen) return null;

  const handleExecuteDelete = async () => {
    setIsDeleting(true);
    setResultMsg('');
    setErrorMsg('');

    try {
      if (mode === 'period') {
        let start = `${selectedMonth}-01`;
        let end = `${selectedMonth}-31`;
        if (customStart || customEnd) {
          start = customStart || '1970-01-01';
          end = customEnd || '2099-12-31';
        }

        const count = await deleteTransactionsByPeriod(start, end);
        setResultMsg(`Berhasil menghapus ${count} transaksi pada periode terpilih.`);
      } else if (mode === 'all_txns') {
        if (confirmInput.trim().toUpperCase() !== 'HAPUS') {
          setErrorMsg('Harap ketik "HAPUS" untuk konfirmasi penghapusan seluruh riwayat.');
          setIsDeleting(false);
          return;
        }
        await clearAllFinancialData('transactions_only');
        setResultMsg('Seluruh data riwayat rekap transaksi telah dibersihkan.');
      } else if (mode === 'all_data') {
        if (confirmInput.trim().toUpperCase() !== 'HAPUS') {
          setErrorMsg('Harap ketik "HAPUS" untuk konfirmasi reset total.');
          setIsDeleting(false);
          return;
        }
        await clearAllFinancialData('all');
        await clearReceipts('all');
        try {
          localStorage.removeItem('ayam_anugerah_receipts_v1');
          window.dispatchEvent(new Event('storage'));
        } catch (e) {
          console.warn(e);
        }
        setResultMsg('Seluruh rekap transaksi, tagihan, dan struk gudang berhasil direset.');
      }

      setConfirmInput('');
      setTimeout(() => {
        onClose();
        setResultMsg('');
        setErrorMsg('');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal menghapus data: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100 bg-rose-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Hapus & Bersihkan Rekap Keuangan</h3>
              <p className="text-xs text-rose-700">Kelola pembersihan riwayat transaksi dan tagihan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Result Alert */}
          {resultMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resultMsg}</span>
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Pilih Cakupan Penghapusan:</label>
            <div className="grid grid-cols-1 gap-2">
              <label
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  mode === 'period'
                    ? 'border-rose-400 bg-rose-50/40 text-gray-900'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="clear_mode"
                  checked={mode === 'period'}
                  onChange={() => setMode('period')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-gray-900">Hapus Rekap Periode Tertentu</div>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    Hanya menghapus transaksi kas pada bulan atau rentang tanggal yang Anda tentukan.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  mode === 'all_txns'
                    ? 'border-rose-400 bg-rose-50/40 text-gray-900'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="clear_mode"
                  checked={mode === 'all_txns'}
                  onChange={() => setMode('all_txns')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-gray-900">
                    Kosongkan Semua Transaksi Kas ({transactions.length} Data)
                  </div>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    Menghapus seluruh catatan pemasukan dan pengeluaran, tetapi tetap mempertahankan daftar tagihan dan kategori.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  mode === 'all_data'
                    ? 'border-rose-400 bg-rose-50/40 text-gray-900'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="clear_mode"
                  checked={mode === 'all_data'}
                  onChange={() => setMode('all_data')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-rose-900">
                    Reset Total (Hapus Transaksi & Semua Tagihan)
                  </div>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    Membersihkan semua transaksi ({transactions.length}) dan tagihan ({bills.length}) untuk memulai pembukuan baru dari nol.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Period Configuration (if mode === 'period') */}
          {mode === 'period' && (
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>Pilih Bulan yang Ingin Dihapus</span>
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setCustomStart('');
                    setCustomEnd('');
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-rose-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-gray-400 font-medium">Atau Rentang Tanggal:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
                />
                <span className="text-xs text-gray-400">-</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
                />
              </div>

              <div className="pt-2 text-xs font-bold text-rose-700">
                Terdeteksi: <strong>{periodCount}</strong> transaksi akan dihapus dari sistem.
              </div>
            </div>
          )}

          {/* Safety Confirmation Input for Total Reset */}
          {(mode === 'all_txns' || mode === 'all_data') && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Konfirmasi Keamanan Penting</span>
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Ketik kata <strong>HAPUS</strong> pada kolom di bawah ini untuk melanjutkan penghapusan:
              </p>
              <input
                type="text"
                placeholder="Ketik HAPUS"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs font-bold text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={
                isDeleting ||
                (mode === 'period' && periodCount === 0) ||
                ((mode === 'all_txns' || mode === 'all_data') && confirmInput.trim().toUpperCase() !== 'HAPUS')
              }
              onClick={handleExecuteDelete}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-600/20 active:scale-95 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? 'Sedang Menghapus...' : 'Konfirmasi Hapus Data'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
