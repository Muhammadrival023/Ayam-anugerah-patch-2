import * as XLSX from 'xlsx';
import { Transaction } from '../types';
import { formatRupiah, generateReceiptNumber } from '../data/defaults';

export interface ExportOptions {
  monthName?: string;
  year?: number;
  fileName?: string;
}

export function exportToExcel(transactions: Transaction[], options?: ExportOptions) {
  const wb = XLSX.utils.book_new();

  // 1. Transactions Sheet
  const txnData = transactions.map((t, idx) => ({
    No: idx + 1,
    Tanggal: t.date,
    Tipe: t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    Kategori: t.category,
    'Jumlah (Rp)': t.amount,
    Keterangan: t.description,
    'Metode Pembayaran': t.paymentMethod,
    'Nomor Struk': t.receiptNumber,
    Catatan: t.note || '',
  }));

  const wsTxns = XLSX.utils.json_to_sheet(txnData);
  XLSX.utils.book_append_sheet(wb, wsTxns, 'Data Transaksi');

  // 2. Summary Sheet
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryTotals: { [key: string]: { type: string; total: number; count: number } } = {};

  transactions.forEach((t) => {
    if (t.type === 'income') totalIncome += t.amount;
    else totalExpense += t.amount;

    if (!categoryTotals[t.category]) {
      categoryTotals[t.category] = { type: t.type, total: 0, count: 0 };
    }
    categoryTotals[t.category].total += t.amount;
    categoryTotals[t.category].count += 1;
  });

  const summaryData = [
    { Metrik: 'Total Pemasukan', Nilai: totalIncome },
    { Metrik: 'Total Pengeluaran', Nilai: totalExpense },
    { Metrik: 'Arus Kas Bersih (Net Balance)', Nilai: totalIncome - totalExpense },
    { Metrik: 'Total Jumlah Transaksi', Nilai: transactions.length },
    { Metrik: '', Nilai: '' },
    { Metrik: 'REKAP PER KATEGORI', Nilai: 'TOTAL (RP)' },
    ...Object.entries(categoryTotals).map(([cat, val]) => ({
      Metrik: `${cat} (${val.type === 'income' ? 'Pemasukan' : 'Pengeluaran'})`,
      Nilai: val.total,
    })),
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Laporan');

  const fileName = options?.fileName || `Laporan_Keuangan_FinTrack_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportToCSV(transactions: Transaction[], fileName?: string) {
  const txnData = transactions.map((t, idx) => ({
    No: idx + 1,
    Tanggal: t.date,
    Tipe: t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    Kategori: t.category,
    Jumlah: t.amount,
    Keterangan: t.description,
    MetodePembayaran: t.paymentMethod,
    NomorStruk: t.receiptNumber,
    Catatan: t.note || '',
  }));

  const ws = XLSX.utils.json_to_sheet(txnData);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName || `Transaksi_FinTrack_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadTemplate(format: 'xlsx' | 'csv') {
  const sampleData = [
    {
      Tanggal: '2026-10-31',
      Tipe: 'Pemasukan',
      Kategori: 'Gaji Pokok',
      Jumlah: 8000000,
      Keterangan: 'Gaji Bulanan',
      MetodePembayaran: 'Transfer BCA',
      Catatan: 'Gaji pokok per bulan',
    },
    {
      Tanggal: '2026-10-31',
      Tipe: 'Pengeluaran',
      Kategori: 'Makanan & Minuman',
      Jumlah: 45000,
      Keterangan: 'Makan Siang',
      MetodePembayaran: 'QRIS',
      Catatan: 'Nasi ayam geprek',
    },
    {
      Tanggal: '2026-10-30',
      Tipe: 'Pengeluaran',
      Kategori: 'Transportasi & Bensin',
      Jumlah: 100000,
      Keterangan: 'Bensin Motor',
      MetodePembayaran: 'Tunai',
      Catatan: 'Pertamax SPBU',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Transaksi');

  if (format === 'xlsx') {
    XLSX.writeFile(wb, 'Template_Impor_Keuangan_FinTrack.xlsx');
  } else {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Template_Impor_Keuangan_FinTrack.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export async function parseImportFile(file: File): Promise<Omit<Transaction, 'id' | 'userId' | 'createdAt'>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);

        const parsed: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[] = [];

        rawJson.forEach((row) => {
          // Normalize column names
          const date = row['Tanggal'] || row['date'] || row['Date'] || new Date().toISOString().slice(0, 10);
          const rawType = (row['Tipe'] || row['type'] || row['Type'] || 'Pengeluaran').toString().toLowerCase();
          const type: 'income' | 'expense' = rawType.includes('pemasukan') || rawType.includes('income') || rawType.includes('masuk') ? 'income' : 'expense';
          const category = row['Kategori'] || row['category'] || row['Category'] || 'Lain-lain';
          const amountRaw = row['Jumlah (Rp)'] || row['Jumlah'] || row['amount'] || row['Amount'] || 0;
          const amount = Math.abs(Number(String(amountRaw).replace(/[^0-9.-]+/g, '')) || 0);
          const description = row['Keterangan'] || row['description'] || row['Deskripsi'] || 'Transaksi Impor';
          const paymentMethod = row['Metode Pembayaran'] || row['MetodePembayaran'] || row['paymentMethod'] || 'Tunai';
          const receiptNumber = row['Nomor Struk'] || row['receiptNumber'] || generateReceiptNumber();
          const note = row['Catatan'] || row['note'] || '';

          if (amount > 0) {
            parsed.push({
              date: String(date).slice(0, 10),
              type,
              category: String(category).trim(),
              amount,
              description: String(description).trim(),
              paymentMethod: String(paymentMethod).trim(),
              receiptNumber: String(receiptNumber).trim(),
              note: String(note).trim(),
            });
          }
        });

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
