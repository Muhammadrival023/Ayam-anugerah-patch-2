import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Category, TransactionType } from '../types';
import { formatRupiah } from '../data/defaults';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  FolderPlus,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#f97316', // orange
  '#ec4899', // pink
  '#3b82f6', // blue
  '#eab308', // yellow
  '#a855f7', // purple
  '#ef4444', // red
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#84cc16', // lime
  '#64748b', // slate
];

export const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose }) => {
  const { categories, addCategory, updateCategory, deleteCategory } = useFinance();

  const [activeTab, setActiveTab] = useState<TransactionType>('expense');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [budget, setBudget] = useState('');

  if (!isOpen) return null;

  const handleStartEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setColor(cat.color);
    setBudget(cat.budget ? cat.budget.toString() : '');
  };

  const handleResetForm = () => {
    setEditingCategory(null);
    setName('');
    setColor(PRESET_COLORS[0]);
    setBudget('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const budgetNum = budget ? parseFloat(budget) : undefined;

    if (editingCategory) {
      await updateCategory(editingCategory.id, {
        name: name.trim(),
        color,
        budget: budgetNum,
      });
    } else {
      await addCategory({
        name: name.trim(),
        type: activeTab,
        icon: 'Tag',
        color,
        budget: budgetNum,
      });
    }

    handleResetForm();
  };

  const handleDelete = async (id: string, catName: string) => {
    if (window.confirm(`Yakin ingin menghapus kategori "${catName}"?`)) {
      await deleteCategory(id);
    }
  };

  const filteredCategories = categories.filter((c) => c.type === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Kategori Penjualan Ayam & Biaya Gudang</h3>
              <p className="text-xs text-gray-500">Atur kategori penjualan ayam potong/karkas dan biaya operasional RPA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-100 px-6 bg-gray-50/50">
          <button
            onClick={() => {
              setActiveTab('expense');
              handleResetForm();
            }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'expense'
                ? 'border-rose-600 text-rose-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Operasional Gudang (Biaya)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('income');
              handleResetForm();
            }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'income'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Penjualan Ayam (Omset)</span>
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="p-4 bg-gray-50 rounded-2xl border border-gray-200/70 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-emerald-600" />
                {editingCategory ? 'Edit Kategori Terpilih' : `+ Tambah Kategori ${activeTab === 'expense' ? 'Biaya Gudang' : 'Penjualan Ayam'}`}
              </span>
              {editingCategory && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-[11px] text-gray-500 hover:underline"
                >
                  Batal Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Nama Kategori</label>
                <input
                  type="text"
                  placeholder="Contoh: Penjualan Ayam Broiler, Es Balok, BBM Solar Armada"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-emerald-500"
                />
              </div>

              {activeTab === 'expense' ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Batas Anggaran Bulanan (Opsional)
                  </label>
                  <input
                    type="number"
                    placeholder="Rp 0 (tanpa batas)"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-emerald-500"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Tipe</label>
                  <div className="py-2 text-xs font-bold text-emerald-600">Pemasukan Kas</div>
                </div>
              )}
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Warna Indikator Kategori</label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-900' : 'hover:scale-110'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
              >
                {editingCategory ? 'Simpan Perubahan' : 'Tambahkan Kategori'}
              </button>
            </div>
          </form>

          {/* List of current categories */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-700">Daftar Kategori Saat Ini ({filteredCategories.length})</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:shadow-2xs transition-shadow"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div>
                      <div className="text-xs font-bold text-gray-900">{cat.name}</div>
                      {cat.budget && cat.budget > 0 && (
                        <div className="text-[10px] text-gray-400">
                          Budget: {formatRupiah(cat.budget)}/bln
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(cat)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                      title="Edit Kategori"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
