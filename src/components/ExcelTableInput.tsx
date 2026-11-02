import React, { useState, useId } from 'react';
import { useFinance } from '../context/FinanceContext';
import { PoultryInvoiceItem, CashFlowAIAnalysis } from '../types/index';
import { POULTRY_PRODUCTS, PAYMENT_TERMS_OPTIONS, formatRupiah, getTodayDateString } from '../data/defaults';
import * as XLSX from 'xlsx';
import { parseWarehouseExcelFile } from '../utils/excelImportWarehouse';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Sparkles,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  Brain,
  MessageSquare,
  Copy,
  Calendar,
  Send,
  RefreshCw,
  X,
  FileCheck,
  TrendingUp,
} from 'lucide-react';

interface ExcelTableInputProps {
  onSuccessSave?: () => void;
}

export const ExcelTableInput: React.FC<ExcelTableInputProps> = ({ onSuccessSave }) => {
  const { addBill, addTransaction, addReceipt, bills, transactions, summary } = useFinance();

  // Initial table rows
  const today = getTodayDateString();

  const createInitialRow = (): PoultryInvoiceItem => {
    const defaultProduct = POULTRY_PRODUCTS[0];
    const defaultKg = 50;
    const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    return {
      id: 'row_' + Math.random().toString(36).substr(2, 9),
      date: today,
      customerName: '',
      productName: defaultProduct.name,
      weightKg: defaultKg,
      pricePerKg: defaultProduct.defaultPrice,
      totalAmount: defaultKg * defaultProduct.defaultPrice,
      paymentTerms: 'Tempo 7 Hari (1 Minggu)',
      dueDate,
      notes: 'Kirim pagi via armada pendingin',
      status: 'unpaid',
    };
  };

  const [rows, setRows] = useState<PoultryInvoiceItem[]>([
    {
      id: 'row_1',
      date: today,
      customerName: 'Restoran Padang Sederhana',
      productName: 'Ayam Broiler Utuh (1.0 - 1.2 kg)',
      weightKg: 85.5,
      pricePerKg: 35000,
      totalAmount: 85.5 * 35000,
      paymentTerms: 'Tempo 7 Hari (1 Minggu)',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: 'Karkas potong 4, kirim jam 05:00',
      status: 'unpaid',
    },
    {
      id: 'row_2',
      date: today,
      customerName: 'Warung Lamongan Mas Joko',
      productName: 'Paha Utuh (Thigh/Drumstick)',
      weightKg: 35.0,
      pricePerKg: 39000,
      totalAmount: 35.0 * 39000,
      paymentTerms: 'Tempo 3 Hari',
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      notes: 'Paha segar tanpa memar',
      status: 'unpaid',
    },
    {
      id: 'row_3',
      date: today,
      customerName: 'Katering Berkah Mandiri',
      productName: 'Fillet Dada Boneless (BLD)',
      weightKg: 60.0,
      pricePerKg: 52000,
      totalAmount: 60.0 * 52000,
      paymentTerms: 'Tempo 14 Hari (2 Minggu)',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      notes: 'Vacuum pack per 2kg',
      status: 'unpaid',
    },
  ]);

  // AI Modal States
  const [isAiReaderOpen, setIsAiReaderOpen] = useState(false);
  const [rawTextToParse, setRawTextToParse] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);

  // AI Cashflow Analysis Modal States
  const [isAiAnalysisOpen, setIsAiAnalysisOpen] = useState(false);
  const [isAnalyzingCashflow, setIsAnalyzingCashflow] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<CashFlowAIAnalysis | null>(null);

  // AI WhatsApp Reminder Modal States
  const [isAiReminderOpen, setIsAiReminderOpen] = useState(false);
  const [selectedBillForReminder, setSelectedBillForReminder] = useState<PoultryInvoiceItem | null>(null);
  const [reminderTone, setReminderTone] = useState<'polite' | 'firm' | 'urgent'>('polite');
  const [generatedReminderMsg, setGeneratedReminderMsg] = useState('');
  const [isGeneratingReminder, setIsGeneratingReminder] = useState(false);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Row operations
  const handleAddRow = () => {
    setRows((prev) => [...prev, createInitialRow()]);
  };

  const handleDeleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof PoultryInvoiceItem, value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        const updated = { ...r, [field]: value };

        // Auto update price if product changes
        if (field === 'productName') {
          const found = POULTRY_PRODUCTS.find((p) => p.name === value);
          if (found) {
            updated.pricePerKg = found.defaultPrice;
            updated.totalAmount = Math.round(updated.weightKg * found.defaultPrice);
          }
        }

        // Auto update total if weight or price changes
        if (field === 'weightKg' || field === 'pricePerKg') {
          const w = field === 'weightKg' ? parseFloat(value) || 0 : r.weightKg;
          const p = field === 'pricePerKg' ? parseFloat(value) || 0 : r.pricePerKg;
          updated.totalAmount = Math.round(w * p);
        }

        // Auto update due date if terms change
        if (field === 'paymentTerms') {
          const days = value.includes('3') ? 3 : value.includes('7') ? 7 : value.includes('14') ? 14 : value.includes('30') ? 30 : 0;
          if (days > 0) {
            const d = new Date(Date.now() + days * 86400000);
            updated.dueDate = d.toISOString().slice(0, 10);
          } else {
            updated.dueDate = today;
          }
        }

        return updated;
      })
    );
  };

  // Grand Totals for current table
  const totalWeight = rows.reduce((sum, r) => sum + (Number(r.weightKg) || 0), 0);
  const totalBillAmount = rows.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

  // AI Parse Excel / Nota Text
  const handleRunAiReader = async () => {
    if (!rawTextToParse.trim()) {
      alert('Harap masukkan atau paste teks data Excel / catatan tagihan ayam.');
      return;
    }

    setIsAiParsing(true);
    try {
      const res = await fetch('/api/ai/parse-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawContent: rawTextToParse }),
      });

      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const parsedRows: PoultryInvoiceItem[] = json.data.map((item: any, idx: number) => ({
          id: 'ai_' + Date.now() + '_' + idx,
          date: today,
          customerName: item.customerName || 'Mitra Ayam',
          productName: item.productName || 'Ayam Broiler Utuh',
          weightKg: Number(item.weightKg) || 10,
          pricePerKg: Number(item.pricePerKg) || 35000,
          totalAmount: Number(item.totalAmount) || (Number(item.weightKg) * Number(item.pricePerKg)),
          paymentTerms: item.paymentTerms || 'Tempo 7 Hari',
          dueDate: item.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          notes: item.notes || 'Hasil ekstrak AI Ayam Anugerah',
          status: 'unpaid',
        }));

        setRows((prev) => [...parsedRows, ...prev]);
        setIsAiReaderOpen(false);
        setRawTextToParse('');
        setSaveSuccessMsg(`Berhasil mengekstrak ${parsedRows.length} data tagihan dengan AI!`);
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      } else {
        alert(json.error || 'AI tidak menemukan baris tagihan yang dapat diproses.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Gagal menghubungi pembaca AI: ' + err.message);
    } finally {
      setIsAiParsing(false);
    }
  };

  // AI Cashflow Analysis
  const handleRunCashflowAnalysis = async () => {
    setIsAiAnalysisOpen(true);
    setIsAnalyzingCashflow(true);
    setAiAnalysisResult(null);

    try {
      const res = await fetch('/api/ai/analyze-cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bills,
          transactions,
          summary: {
            ...summary,
            tableBillsCount: rows.length,
            tableBillsAmount: totalBillAmount,
          },
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setAiAnalysisResult(json.data);
      } else {
        alert(json.error || 'Gagal menganalisa arus kas.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Gagal menjalankan penganalisa AI: ' + err.message);
    } finally {
      setIsAnalyzingCashflow(false);
    }
  };

  // AI WhatsApp Reminder
  const handleOpenReminderModal = (row: PoultryInvoiceItem) => {
    setSelectedBillForReminder(row);
    setReminderTone('polite');
    setGeneratedReminderMsg('');
    setIsAiReminderOpen(true);
    generateReminder(row, 'polite');
  };

  const generateReminder = async (row: PoultryInvoiceItem, tone: 'polite' | 'firm' | 'urgent') => {
    setIsGeneratingReminder(true);
    try {
      const res = await fetch('/api/ai/generate-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bill: row, tone }),
      });
      const json = await res.json();
      if (json.success && json.message) {
        setGeneratedReminderMsg(json.message);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsGeneratingReminder(false);
    }
  };

  // Upload Excel file into grid
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await parseWarehouseExcelFile(file);
      if (result.invoiceItems.length > 0) {
        setRows(result.invoiceItems);
        setSaveSuccessMsg(
          `Berhasil memuat ${result.invoiceItems.length} baris dari file "${file.name}" (${result.isGoogleSheetFormat ? 'Format Google Sheets' : 'Format Excel'})!`
        );
        setTimeout(() => setSaveSuccessMsg(''), 5000);
      }
    } catch (err: any) {
      console.error(err);
      alert('Gagal membaca file Excel: ' + (err.message || 'Format tidak dikenali'));
    }
  };

  // Download Poultry Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Tanggal: today,
        'Nama Pelanggan': 'RM Padang Sederhana',
        'Jenis Ayam': 'Ayam Broiler Utuh (1.0 - 1.2 kg)',
        'Bobot (Kg)': 100.5,
        'Harga / Kg': 35000,
        'Total Tagihan': 100.5 * 35000,
        'Syarat Bayar': 'Tempo 7 Hari',
        'Jatuh Tempo': new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        Catatan: 'Kirim subuh 04:30',
      },
      {
        Tanggal: today,
        'Nama Pelanggan': 'Warung Pecel Lele Mas Joko',
        'Jenis Ayam': 'Paha Utuh (Thigh/Drumstick)',
        'Bobot (Kg)': 40.0,
        'Harga / Kg': 39000,
        'Total Tagihan': 40.0 * 39000,
        'Syarat Bayar': 'Tempo 3 Hari',
        'Jatuh Tempo': new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        Catatan: 'Kualitas segar harian',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Tagihan Ayam');
    XLSX.writeFile(wb, 'Template_Tagihan_Ayam_Anugerah.xlsx');
  };

  // Save all rows to database as active bills AND warehouse receipts
  const handleSaveAllToDatabase = async () => {
    if (rows.length === 0) {
      alert('Tabel tagihan masih kosong.');
      return;
    }

    const invalid = rows.find((r) => !r.customerName.trim() || r.totalAmount <= 0);
    if (invalid) {
      alert('Harap isi Nama Pelanggan dan pastikan nominal valid untuk setiap baris.');
      return;
    }

    setIsSaving(true);
    try {
      for (const row of rows) {
        const title = `Tagihan ${row.customerName} - ${row.productName} (${row.weightKg} Kg)`;
        await addBill({
          title,
          amount: row.totalAmount,
          category: 'Pelunasan Tagihan Tempo Mitra',
          dueDate: row.dueDate,
          repeatFrequency: 'once',
          status: 'unpaid',
          reminderDaysBefore: 2,
          notes: `Mitra: ${row.customerName} | Produk: ${row.productName} | Bobot: ${row.weightKg} Kg @ Rp${row.pricePerKg}/kg | Syarat: ${row.paymentTerms} | Catatan: ${row.notes || '-'}`,
        });

        // Also integrate as official warehouse receipt in Struk Gudang
        await addReceipt({
          id: 'rcp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          userId: 'guest',
          receiptNumber: `AA-${Date.now().toString().slice(-4)}`,
          date: row.date,
          customerName: row.customerName,
          customerCode: `#${row.customerName.slice(0, 3).toUpperCase()}`,
          noteBox: row.notes || '',
          items: [
            {
              name: row.productName,
              quantity: row.weightKg,
              unit: 'kg',
              price: row.pricePerKg,
              total: row.totalAmount,
            },
          ],
          totalAmount: row.totalAmount,
          status: 'BELUM LUNAS',
          createdAt: new Date().toISOString(),
        });
      }

      setSaveSuccessMsg(`Berhasil menyimpan ${rows.length} tagihan ke sistem! Tersimpan sebagai piutang & struk gudang.`);
      if (onSuccessSave) onSuccessSave();
      setTimeout(() => setSaveSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error(err);
      alert('Gagal menyimpan tagihan ke database: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="bg-gradient-to-r from-amber-700 via-orange-600 to-emerald-800 rounded-3xl p-6 lg:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 z-10 relative">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-xs font-semibold backdrop-blur-xs">
              <Brain className="w-3.5 h-3.5 text-amber-200" />
              <span>Sistem Manajemen Tagihan & Arus Kas Ayam Anugerah</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              Table Input Excel & Penganalisa AI
            </h1>
            <p className="text-amber-100 text-xs sm:text-sm leading-relaxed">
              Input tagihan penjualan ayam potong/karkas secara massal layaknya spreadsheet Excel, dilengkapi ekstraksi otomatis teks nota dan analisa risiko arus kas berbasis AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsAiReaderOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-900 hover:bg-amber-50 text-xs font-bold rounded-xl transition-all active:scale-95 shadow-md"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Pembaca AI (Paste Nota/WA)</span>
            </button>

            <button
              onClick={handleRunCashflowAnalysis}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-md"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Penganalisa AI Arus Kas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Bar */}
      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMsg('')}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Spreadsheet Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Baris</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-gray-500" />
            <span>Unggah Excel / CSV</span>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Unduh Template (.xlsx)</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 hidden sm:block">
            Total Bobot: <strong className="text-gray-900">{totalWeight.toFixed(1)} Kg</strong> | Nilai Tagihan:{' '}
            <strong className="text-emerald-700">{formatRupiah(totalBillAmount)}</strong>
          </div>

          <button
            onClick={handleSaveAllToDatabase}
            disabled={isSaving || rows.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-600/20 disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileCheck className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Menyimpan...' : `Simpan Semua Tagihan (${rows.length})`}</span>
          </button>
        </div>
      </div>

      {/* Interactive Spreadsheet Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-gray-200 text-gray-700 font-extrabold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 min-w-[130px]">Tanggal</th>
                <th className="py-3 px-3 min-w-[180px]">Nama Pelanggan / Mitra</th>
                <th className="py-3 px-3 min-w-[190px]">Jenis Produk Ayam</th>
                <th className="py-3 px-3 min-w-[100px] text-right">Bobot (Kg)</th>
                <th className="py-3 px-3 min-w-[120px] text-right">Harga / Kg</th>
                <th className="py-3 px-3 min-w-[140px] text-right">Total Tagihan</th>
                <th className="py-3 px-3 min-w-[150px]">Syarat Pembayaran</th>
                <th className="py-3 px-3 min-w-[130px]">Jatuh Tempo</th>
                <th className="py-3 px-3 min-w-[160px]">Catatan Khusus</th>
                <th className="py-3 px-3 text-center min-w-[100px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, index) => (
                <tr key={row.id} className="hover:bg-amber-50/30 transition-colors">
                  {/* Row Number */}
                  <td className="py-2.5 px-3 text-center font-mono text-gray-400 font-bold">
                    {index + 1}
                  </td>

                  {/* Date */}
                  <td className="py-2 px-3">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => handleUpdateRow(row.id, 'date', e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:bg-white focus:outline-emerald-500"
                    />
                  </td>

                  {/* Customer Name */}
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      placeholder="Contoh: RM Sederhana"
                      value={row.customerName}
                      onChange={(e) => handleUpdateRow(row.id, 'customerName', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:bg-white focus:outline-emerald-500"
                    />
                  </td>

                  {/* Product Name */}
                  <td className="py-2 px-3">
                    <select
                      value={row.productName}
                      onChange={(e) => handleUpdateRow(row.id, 'productName', e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:bg-white focus:outline-emerald-500"
                    >
                      {POULTRY_PRODUCTS.map((prod) => (
                        <option key={prod.name} value={prod.name}>
                          {prod.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Weight (Kg) */}
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row.weightKg}
                      onChange={(e) => handleUpdateRow(row.id, 'weightKg', e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-right font-mono font-bold text-gray-900 focus:bg-white focus:outline-emerald-500"
                    />
                  </td>

                  {/* Price per Kg */}
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="500"
                      min="0"
                      value={row.pricePerKg}
                      onChange={(e) => handleUpdateRow(row.id, 'pricePerKg', e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-right font-mono text-gray-800 focus:bg-white focus:outline-emerald-500"
                    />
                  </td>

                  {/* Total Bill Amount (Calculated) */}
                  <td className="py-2 px-3 text-right">
                    <div className="font-mono font-extrabold text-emerald-700 px-2 py-1 bg-emerald-50/70 rounded-lg">
                      {formatRupiah(row.totalAmount)}
                    </div>
                  </td>

                  {/* Payment Terms */}
                  <td className="py-2 px-3">
                    <select
                      value={row.paymentTerms}
                      onChange={(e) => handleUpdateRow(row.id, 'paymentTerms', e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:bg-white focus:outline-emerald-500"
                    >
                      {PAYMENT_TERMS_OPTIONS.map((term) => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Due Date */}
                  <td className="py-2 px-3">
                    <input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) => handleUpdateRow(row.id, 'dueDate', e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:bg-white focus:outline-emerald-500"
                    />
                  </td>

                  {/* Notes */}
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      placeholder="Catatan..."
                      value={row.notes || ''}
                      onChange={(e) => handleUpdateRow(row.id, 'notes', e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 focus:bg-white focus:outline-emerald-500"
                    />
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenReminderModal(row)}
                        title="Buat Pesan Tagihan WA AI"
                        className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        title="Hapus Baris"
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Table Footer Summary */}
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t-2 border-gray-200 text-xs">
                <td colSpan={4} className="py-3 px-4 text-gray-600">
                  TOTAL KESELURUHAN ({rows.length} TAGIHAN AYAM)
                </td>
                <td className="py-3 px-3 text-right font-mono text-gray-900 font-extrabold">
                  {totalWeight.toFixed(1)} Kg
                </td>
                <td className="py-3 px-3"></td>
                <td className="py-3 px-3 text-right font-mono text-emerald-700 font-extrabold text-sm">
                  {formatRupiah(totalBillAmount)}
                </td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* AI Pembaca Excel & Nota Pesanan Modal */}
      {isAiReaderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-amber-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    Pembaca AI Excel & Nota Tagihan Ayam
                  </h3>
                  <p className="text-xs text-gray-500">
                    Otomatis mengekstrak teks Excel / chat WhatsApp menjadi baris tabel
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiReaderOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  Paste teks data Excel, pesan WhatsApp, atau catatan pengiriman ayam di sini:
                </label>
                <textarea
                  rows={7}
                  placeholder={`Contoh:\n1. RM Padang Sederhana: 80 kg broiler @35.000 tempo 7 hari\n2. Warung Mas Joko paha 40 kg @39rb bayar 3 hari lagi\n3. Katering Bu Siti dada fillet 50 kg harga 52rb tempo 14 hari`}
                  value={rawTextToParse}
                  onChange={(e) => setRawTextToParse(e.target.value)}
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-900 font-mono focus:bg-white focus:outline-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setRawTextToParse(`Kirim Ayam Anugerah 31 Okt:
1. Resto Ayam Geprek Juara: Broiler 1.0-1.2kg 120 kg @Rp34.500 tempo 7 hari.
2. Warung Tenda Cak No: Sayap 30 kg @Rp38.000 tempo 3 hari.
3. Hotel Grand Mulia: Fillet Dada BLD 75 kg @Rp52.000 tempo 14 hari.
4. Agen Pasar Rebo: Karkas 200 kg @Rp33.000 COD cash.`)
                  }
                  className="text-[11px] text-amber-700 hover:underline font-semibold"
                >
                  Contoh Data Otomatis
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAiReaderOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleRunAiReader}
                    disabled={isAiParsing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-600/20 disabled:opacity-50"
                  >
                    {isAiParsing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>{isAiParsing ? 'AI Sedang Membaca...' : 'Ekstrak ke Tabel Grid'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Cash Flow & Accounts Receivable Analysis Modal */}
      {isAiAnalysisOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-emerald-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    Penganalisa AI: Kesehatan Arus Kas & Piutang Ayam
                  </h3>
                  <p className="text-xs text-gray-500">
                    Evaluasi komprehensif risiko perputaran modal usaha Ayam Anugerah
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiAnalysisOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {isAnalyzingCashflow ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-gray-800">
                    Gemini AI sedang menghitung arus kas & analisis aging piutang...
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Mengevaluasi tagihan tempo, jadwal kirim ayam, dan pengeluaran operasional.
                  </p>
                </div>
              ) : aiAnalysisResult ? (
                <div className="space-y-4">
                  {/* Health Score Card */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        Skor Kesehatan Keuangan Bisnis
                      </span>
                      <h4 className="text-xl font-extrabold text-emerald-950 mt-0.5">
                        {aiAnalysisResult.healthStatus}
                      </h4>
                    </div>
                    <div className="text-3xl font-black font-mono text-emerald-600">
                      {aiAnalysisResult.healthScore}
                      <span className="text-sm text-emerald-400 font-normal">/100</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold text-gray-900">Ringkasan Arus Kas Operasional</h5>
                    <p className="text-xs text-gray-700 leading-relaxed p-3 bg-gray-50 rounded-xl border border-gray-100">
                      {aiAnalysisResult.summaryAnalysis}
                    </p>
                  </div>

                  {/* Receivables Risk */}
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold text-rose-900">Evaluasi Risiko Piutang Mitra (Aging)</h5>
                    <p className="text-xs text-gray-700 leading-relaxed p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                      {aiAnalysisResult.receivablesRisk}
                    </p>
                  </div>

                  {/* Forecast */}
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold text-indigo-900">Proyeksi Likuiditas 7-14 Hari ke Depan</h5>
                    <p className="text-xs text-gray-700 leading-relaxed p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      {aiAnalysisResult.cashFlowForecast}
                    </p>
                  </div>

                  {/* Action Recommendations */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-gray-900">Rekomendasi Aksi Konkret Pemilik Usaha:</h5>
                    <ul className="space-y-1.5 text-xs">
                      {aiAnalysisResult.actionRecommendations.map((act, i) => (
                        <li key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="text-gray-800">{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* AI WhatsApp Reminder Modal */}
      {isAiReminderOpen && selectedBillForReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-emerald-50/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    AI Penagihan WhatsApp: {selectedBillForReminder.customerName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Otomatis buat pesan penagihan ramah dan profesional
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiReminderOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Pilih Gaya Pesan (Tone):</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'polite', label: 'Sopan & Ramah' },
                    { id: 'firm', label: 'Tegas / Formal' },
                    { id: 'urgent', label: 'Mendesak / Peringatan' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setReminderTone(t.id as any);
                        generateReminder(selectedBillForReminder, t.id as any);
                      }}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                        reminderTone === t.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-gray-700">Pratinjau Draf Pesan WhatsApp:</label>
                  {generatedReminderMsg && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedReminderMsg);
                        alert('Pesan berhasil disalin ke clipboard!');
                      }}
                      className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin Pesan</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  {isGeneratingReminder ? (
                    <div className="h-40 flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-200">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                    </div>
                  ) : (
                    <textarea
                      rows={8}
                      value={generatedReminderMsg}
                      onChange={(e) => setGeneratedReminderMsg(e.target.value)}
                      className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-sans text-gray-800 leading-relaxed focus:bg-white focus:outline-emerald-500"
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAiReminderOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const encoded = encodeURIComponent(generatedReminderMsg);
                    const link = document.createElement('a');
                    link.href = `https://api.whatsapp.com/send?text=${encoded}`;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim ke WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
