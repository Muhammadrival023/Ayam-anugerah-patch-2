import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction, TransactionType } from '../types';
import { PAYMENT_METHODS, generateReceiptNumber, getTodayDateString, formatRupiah } from '../data/defaults';
import { X, Check, Plus, Tag, Calendar, CreditCard, FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: TransactionType;
  editingTransaction?: Transaction | null;
  onTransactionSaved?: (transaction: Transaction) => void;
  onOpenCategoryManager?: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  initialType = 'expense',
  editingTransaction,
  onTransactionSaved,
  onOpenCategoryManager,
}) => {
  const { categories, addTransaction, updateTransaction } = useFinance();

  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<string>('QRIS');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);

  // Initialize or reset form
  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(editingTransaction.amount.toString());
      setCategory(editingTransaction.category);
      setDescription(editingTransaction.description);
      setDate(editingTransaction.date);
      setPaymentMethod(editingTransaction.paymentMethod);
      setReceiptNumber(editingTransaction.receiptNumber);
      setNote(editingTransaction.note || '');
    } else {
      setType(initialType);
      setAmount('');
      setDescription('');
      setDate(getTodayDateString());
      setPaymentMethod('Tunai Kasir Gudang');
      setReceiptNumber(generateReceiptNumber());
      setNote('');

      // Pick first matching category
      const firstCat = categories.find((c) => c.type === initialType);
      setCategory(firstCat ? firstCat.name : '');
    }
  }, [isOpen, editingTransaction, initialType, categories]);

  // Update default category when type switches
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const firstCat = categories.find((c) => c.type === newType);
    if (firstCat) {
      setCategory(firstCat.name);
    }
  };

  const handleAddQuickAmount = (val: number) => {
    const current = Number(amount) || 0;
    setAmount((current + val).toString());
  };

  const filteredCategories = categories.filter((c) => c.type === type);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      alert('Harap masukkan nominal transaksi penjualan atau operasional yang valid.');
      return;
    }
    if (!category) {
      alert('Harap pilih kategori transaksi ayam.');
      return;
    }
    if (!description.trim()) {
      alert('Harap masukkan keterangan transaksi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        type,
        amount: numericAmount,
        category,
        description: description.trim(),
        date,
        paymentMethod,
        receiptNumber: receiptNumber || generateReceiptNumber(),
        note: note.trim(),
      };

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, payload);
        if (onTransactionSaved) {
          onTransactionSaved({
            ...editingTransaction,
            ...payload,
          });
        }
      } else {
        const newId = await addTransaction(payload);
        if (onTransactionSaved) {
          onTransactionSaved({
            ...payload,
            id: newId,
            userId: '',
            createdAt: new Date().toISOString(),
          });
        }
      }

      onClose();
    } catch (err) {
      console.error('Error saving transaction:', err);
      alert('Gagal menyimpan transaksi. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80">
          <h3 className="font-bold text-gray-900 text-lg">
            {editingTransaction ? 'Edit Catatan Kas Ayam' : 'Catat Penjualan / Pengeluaran Ayam'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Type Selector (Pemasukan vs Pengeluaran) */}
          <div className="grid grid-cols-2 gap-3 p-1 bg-gray-100 rounded-2xl">
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>PENJUALAN AYAM (MASUK)</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>OPERASIONAL GUDANG (KELUAR)</span>
            </button>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Nominal Transaksi (Rp)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">
                Rp
              </span>
              <input
                type="number"
                placeholder="0"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xl font-extrabold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[500000, 1000000, 2500000, 5000000, 10000000, 20000000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleAddQuickAmount(val)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors border border-gray-200"
                >
                  +{val >= 1000000 ? `${val / 1000000} Jt` : `${val / 1000}rb`}
                </button>
              ))}
            </div>
          </div>

          {/* Category Picker */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-700">Kategori Ayam / Gudang</label>
              {onOpenCategoryManager && (
                <button
                  type="button"
                  onClick={onOpenCategoryManager}
                  className="text-[11px] font-medium text-emerald-600 hover:underline"
                >
                  + Kategori Ayam
                </button>
              )}
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:outline-emerald-500"
            >
              <option value="" disabled>
                Pilih Kategori Ayam
              </option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Keterangan / Pelanggan</label>
            <input
              type="text"
              placeholder="Contoh: Penjualan Ayam Gebrus 470 ekor (Pak Ade #11), Pembelian Ayam Hidup Subang, Es Balok 30 balok"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-emerald-500"
            />
          </div>

          {/* Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>Tanggal</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:bg-white focus:outline-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                <span>Metode Bayar</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:bg-white focus:outline-emerald-500"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Receipt Number (Auto or Custom) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                <span>Nomor Struk / Bukti Transaksi</span>
              </label>
              <button
                type="button"
                onClick={() => setReceiptNumber(generateReceiptNumber())}
                className="text-[11px] text-emerald-600 hover:underline"
              >
                Buat Baru
              </button>
            </div>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="RCP-20261031-..."
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 focus:bg-white focus:outline-emerald-500"
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Catatan Tambahan (Opsional)</label>
            <textarea
              rows={2}
              placeholder="Catatan toko, no garansi, atau detail belanja..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:outline-emerald-500"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : editingTransaction ? 'Perbarui Transaksi' : 'Simpan Transaksi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
