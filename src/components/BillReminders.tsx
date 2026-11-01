import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Bill, BillFrequency } from '../types';
import { formatRupiah, getTodayDateString } from '../data/defaults';
import { requestNotificationPermission, sendBillNotification } from '../utils/notifications';
import {
  Bell,
  BellRing,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Trash2,
  X,
  CreditCard,
  DollarSign,
  Zap,
} from 'lucide-react';

export const BillReminders: React.FC = () => {
  const { bills, categories, addBill, updateBill, deleteBill, markBillAsPaid } = useFinance();

  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'paid' | 'overdue'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Pelunasan Tagihan Gudang');
  const [dueDate, setDueDate] = useState(getTodayDateString());
  const [repeatFrequency, setRepeatFrequency] = useState<BillFrequency>('once');
  const [reminderDaysBefore, setReminderDaysBefore] = useState(1);
  const [notes, setNotes] = useState('');

  const [browserNotifEnabled, setBrowserNotifEnabled] = useState(
    'Notification' in window && Notification.permission === 'granted'
  );

  const todayStr = getTodayDateString();

  const handleRequestNotif = async () => {
    const granted = await requestNotificationPermission();
    setBrowserNotifEnabled(granted);
    if (granted) {
      sendBillNotification('Alarm Piutang Ayam Aktif', {
        body: 'Anda akan menerima pengingat otomatis sebelum tanggal tempo pembayaran ayam tiba.',
      });
    }
  };

  const openAddModal = (bill?: Bill) => {
    if (bill) {
      setEditingBill(bill);
      setTitle(bill.title);
      setAmount(bill.amount.toString());
      setCategory(bill.category);
      setDueDate(bill.dueDate);
      setRepeatFrequency(bill.repeatFrequency);
      setReminderDaysBefore(bill.reminderDaysBefore);
      setNotes(bill.notes || '');
    } else {
      setEditingBill(null);
      setTitle('');
      setAmount('');
      setCategory('Pelunasan Tagihan Gudang');
      setDueDate(getTodayDateString());
      setRepeatFrequency('once');
      setReminderDaysBefore(1);
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      alert('Harap masukkan jumlah nominal tagihan/piutang.');
      return;
    }
    if (!title.trim()) {
      alert('Harap masukkan nama pelanggan atau keterangan tagihan.');
      return;
    }

    const payload = {
      title: title.trim(),
      amount: numAmount,
      category,
      dueDate,
      repeatFrequency,
      status: (editingBill ? editingBill.status : 'unpaid') as any,
      reminderDaysBefore,
      notes: notes.trim(),
    };

    if (editingBill) {
      await updateBill(editingBill.id, payload);
    } else {
      await addBill(payload);
    }

    setIsModalOpen(false);
  };

  const getStatusInfo = (bill: Bill) => {
    if (bill.status === 'paid') {
      return {
        label: 'LUNAS',
        bgColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: CheckCircle2,
      };
    }
    if (bill.dueDate < todayStr) {
      return {
        label: 'LEWAT TEMPO!',
        bgColor: 'bg-rose-100 text-rose-800 border-rose-200',
        icon: AlertTriangle,
      };
    }
    if (bill.dueDate === todayStr) {
      return {
        label: 'JATUH TEMPO HARI INI',
        bgColor: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: Clock,
      };
    }
    // Calculate days remaining
    const diffTime = new Date(bill.dueDate).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      label: `H-${diffDays} HARI`,
      bgColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: Calendar,
    };
  };

  const filteredBills = bills.filter((b) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'paid') return b.status === 'paid';
    if (filterStatus === 'unpaid') return b.status === 'unpaid' && b.dueDate >= todayStr;
    if (filterStatus === 'overdue') return b.status === 'unpaid' && b.dueDate < todayStr;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner with Notification Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border border-gray-100 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <BellRing className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Piutang & Tempo Pelanggan Ayam Anugerah</h2>
          </div>
          <p className="text-xs text-gray-500">
            Pantau nota pengiriman ayam ke pelanggan (warung, restoran, katering, pasar) dan jatuh tempo pembelian ayam peternak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!browserNotifEnabled ? (
            <button
              onClick={handleRequestNotif}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span>Aktifkan Alarm Pengingat</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Alarm Pengingat Aktif</span>
            </span>
          )}

          <button
            onClick={() => openAddModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Catat Piutang Pelanggan</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-gray-100/70 p-1.5 rounded-2xl max-w-fit">
        {[
          { id: 'all', label: 'Semua Nota' },
          { id: 'unpaid', label: 'Akan Datang' },
          { id: 'overdue', label: 'Lewat Tempo' },
          { id: 'paid', label: 'Lunas' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id as any)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
              filterStatus === tab.id
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bills Cards Grid */}
      {filteredBills.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-gray-700">Tidak ada data piutang pada status ini</h3>
          <p className="text-xs text-gray-400 mt-1">
            Klik tombol "+ Catat Piutang Pelanggan" untuk mencatat nota kirim ayam tempo baru.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBills.map((bill) => {
            const status = getStatusInfo(bill);
            const StatusIcon = status.icon;

            return (
              <div
                key={bill.id}
                className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${status.bgColor}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      <span>{status.label}</span>
                    </span>

                    <button
                      onClick={() => deleteBill(bill.id)}
                      className="text-gray-300 hover:text-rose-600 transition-colors p-1"
                      title="Hapus Tagihan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="font-bold text-gray-900 text-sm mb-1">{bill.title}</h3>
                  <div className="text-base font-extrabold text-emerald-700 font-mono mb-2">
                    {formatRupiah(bill.amount)}
                  </div>

                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>Jatuh Tempo: <strong>{bill.dueDate}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-gray-400" />
                      <span>Frekuensi: {bill.repeatFrequency === 'monthly' ? 'Bulanan' : bill.repeatFrequency}</span>
                    </div>
                    {bill.notes && (
                      <div className="p-2 bg-gray-50 rounded-lg text-[11px] text-gray-600 mt-2 italic">
                        {bill.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                  {bill.status === 'unpaid' ? (
                    <button
                      onClick={() => markBillAsPaid(bill.id, true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Bayar & Catat Pengeluaran</span>
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-between">
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Lunas tercatat
                      </span>
                      <button
                        onClick={() => updateBill(bill.id, { status: 'unpaid' })}
                        className="text-[11px] text-gray-400 hover:text-gray-600 hover:underline"
                      >
                        Tandai Belum Lunas
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Bill Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-900 text-base">
                {editingBill ? 'Edit Tagihan' : 'Tambah Tagihan Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Pelanggan / Keterangan Tagihan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Moris (#09) - Ayam Gebrus 30 ekor, Warung Lamongan Mas Joko"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Nominal Piutang / Tagihan (Rp)</label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-900 focus:bg-white focus:outline-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Tanggal Jatuh Tempo</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:outline-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Jenis Tempo</label>
                  <select
                    value={repeatFrequency}
                    onChange={(e) => setRepeatFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:outline-emerald-500"
                  >
                    <option value="once">Sekali Bayar (Per Nota)</option>
                    <option value="weekly">Mingguan (Rutin Toko)</option>
                    <option value="monthly">Bulanan (Katering/Resto)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:outline-emerald-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Catatan Khusus Pengiriman / Kode Struk</label>
                <input
                  type="text"
                  placeholder="Contoh: Ket: Pita Putih, 40 ekor (69.5 kg), Ati 80 bj"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:outline-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-xl hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
                >
                  Simpan Piutang Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
