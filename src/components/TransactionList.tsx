import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction, TransactionType } from '../types';
import { formatRupiah } from '../data/defaults';
import {
  Search,
  Filter,
  Printer,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  Tag,
  CreditCard,
  FileText,
  Calendar,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';

interface TransactionListProps {
  onOpenAddModal: (type?: TransactionType) => void;
  onEditTransaction: (txn: Transaction) => void;
  onViewReceipt: (txn: Transaction) => void;
  onOpenClearModal?: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  onOpenAddModal,
  onEditTransaction,
  onViewReceipt,
  onOpenClearModal,
}) => {
  const { transactions, categories, deleteTransaction, deleteTransactionsBatch } = useFinance();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        // Search term filter
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchDesc = t.description.toLowerCase().includes(term);
          const matchCat = t.category.toLowerCase().includes(term);
          const matchMethod = t.paymentMethod.toLowerCase().includes(term);
          const matchReceipt = t.receiptNumber.toLowerCase().includes(term);
          const matchNote = t.note ? t.note.toLowerCase().includes(term) : false;
          if (!matchDesc && !matchCat && !matchMethod && !matchReceipt && !matchNote) {
            return false;
          }
        }

        // Type filter
        if (selectedType !== 'all' && t.type !== selectedType) {
          return false;
        }

        // Category filter
        if (selectedCategory !== 'all' && t.category !== selectedCategory) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortBy === 'date-asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === 'amount-desc') return b.amount - a.amount;
        if (sortBy === 'amount-asc') return a.amount - b.amount;
        return 0;
      });
  }, [transactions, searchTerm, selectedType, selectedCategory, sortBy]);

  const handleDelete = async (id: string, desc: string) => {
    if (window.confirm(`Yakin ingin menghapus transaksi "${desc}"?`)) {
      setDeletingId(id);
      try {
        await deleteTransaction(id);
        setSelectedIds((prev) => prev.filter((i) => i !== id));
      } catch (err) {
        console.error('Delete error:', err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredTransactions.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Yakin ingin menghapus ${selectedIds.length} transaksi yang dipilih?`)) {
      setIsBulkDeleting(true);
      try {
        await deleteTransactionsBatch(selectedIds);
        setSelectedIds([]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsBulkDeleting(false);
      }
    }
  };

  const isAllSelected =
    filteredTransactions.length > 0 && selectedIds.length === filteredTransactions.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
      {/* List Header & Controls */}
      <div className="p-5 border-b border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base lg:text-lg font-bold text-gray-900">
              Riwayat Transaksi & Arus Kas
            </h2>
            <p className="text-xs text-gray-500">
              Menampilkan {filteredTransactions.length} dari total {transactions.length} transaksi
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenClearModal && (
              <button
                onClick={onOpenClearModal}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Rekap</span>
              </button>
            )}

            <button
              onClick={() => onOpenAddModal('expense')}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>+ Biaya Gudang</span>
            </button>
            <button
              onClick={() => onOpenAddModal('income')}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+ Penjualan Ayam</span>
            </button>
          </div>
        </div>

        {/* Bulk Selection Notification Bar */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <CheckSquare className="w-4 h-4 text-amber-700" />
              <span>{selectedIds.length} transaksi terpilih</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1 text-xs text-gray-600 hover:underline"
              >
                Batal Pilih
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBulkDeleting ? 'Menghapus...' : `Hapus ${selectedIds.length} Terpilih`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari transaksi, struk, kategori..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-emerald-500"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-emerald-500"
            >
              <option value="all">Semua Jenis Transaksi</option>
              <option value="income">Hanya Pemasukan</option>
              <option value="expense">Hanya Pengeluaran</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-emerald-500"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} ({c.type === 'income' ? 'Masuk' : 'Keluar'})
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-emerald-500"
            >
              <option value="date-desc">Tanggal: Terbaru</option>
              <option value="date-asc">Tanggal: Terlama</option>
              <option value="amount-desc">Nominal: Tertinggi</option>
              <option value="amount-asc">Nominal: Terendah</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table / List */}
      {filteredTransactions.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-700">Tidak ada transaksi yang cocok</h3>
          <p className="text-xs text-gray-400 mt-1">
            Coba ubah filter pencarian atau tambahkan transaksi baru.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded-sm text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="py-3 px-4">Tanggal & Struk</th>
                <th className="py-3 px-4">Deskripsi</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Metode Bayar</th>
                <th className="py-3 px-4 text-right">Nominal</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredTransactions.map((txn) => {
                const isIncome = txn.type === 'income';
                const isSelected = selectedIds.includes(txn.id);

                return (
                  <tr
                    key={txn.id}
                    className={`transition-colors group ${
                      isSelected ? 'bg-amber-50/60' : 'hover:bg-emerald-50/30'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(txn.id)}
                        className="rounded-sm text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>

                    {/* Date & Receipt badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1.5 rounded-lg ${
                            isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isIncome ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{txn.date}</div>
                          <div className="text-[10px] font-mono text-gray-400">{txn.receiptNumber}</div>
                        </div>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-gray-800 break-words max-w-xs">{txn.description}</div>
                      {txn.note && (
                        <div className="text-[11px] text-gray-400 italic line-clamp-1">{txn.note}</div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        <Tag className="w-3 h-3 text-gray-400" />
                        <span>{txn.category}</span>
                      </span>
                    </td>

                    {/* Payment Method */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-gray-600">
                        <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                        <span>{txn.paymentMethod}</span>
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div
                        className={`text-sm font-extrabold font-mono ${
                          isIncome ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isIncome ? '+' : '-'} {formatRupiah(txn.amount)}
                      </div>
                    </td>

                    {/* Actions: Print Receipt, Edit, Delete */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onViewReceipt(txn)}
                          title="Cetak Receipt / Struk Fisik"
                          className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditTransaction(txn)}
                          title="Edit Transaksi"
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(txn.id, txn.description)}
                          title="Hapus Transaksi"
                          disabled={deletingId === txn.id}
                          className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
