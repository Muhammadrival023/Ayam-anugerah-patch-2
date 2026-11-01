import * as XLSX from 'xlsx';
import { AyamAnugrahReceipt, AyamReceiptLineItem, PoultryInvoiceItem } from '../types/index';
import { formatAngkaIndo, getTodayDateString } from '../data/defaults';

export interface ParsedWarehouseRow {
  no: number;
  customerName: string;
  customerCode?: string;
  ekor: number;
  ayamKg: number;
  ayamPrice: number;
  ayamTotal: number;
  atiBiji: number;
  atiPrice: number;
  atiTotal: number;
  ususKg: number;
  ususPrice: number;
  ususTotal: number;
  grandTotal: number;
  keterangan: string;
  status: 'BELUM LUNAS' | 'LUNAS';
}

export interface ParsedWarehouseImportResult {
  fileName: string;
  detectedDate: string;
  isGoogleSheetFormat: boolean;
  rows: ParsedWarehouseRow[];
  receipts: AyamAnugrahReceipt[];
  invoiceItems: PoultryInvoiceItem[];
  totals: {
    totalCustomers: number;
    totalEkor: number;
    totalAyamKg: number;
    totalAyamTotal: number;
    totalAtiBiji: number;
    totalAtiTotal: number;
    totalUsusKg: number;
    totalUsusTotal: number;
    grandTotal: number;
  };
}

/**
 * Robust parser for Excel (.xlsx, .xls) and CSV files.
 * Automatically recognizes:
 * 1. "DATA HARIAN GUDANG - AYAM @ ANUGRAH" multi-column layout from Google Sheets
 * 2. Flat tabular poultry sales spreadsheets
 */
export async function parseWarehouseExcelFile(file: File): Promise<ParsedWarehouseImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!aoa || aoa.length === 0) {
          throw new Error('File Excel kosong atau tidak terbaca.');
        }

        // 1. Detect if sheet is Google Sheet format ("DATA HARIAN GUDANG")
        let isGoogleSheetFormat = false;
        let detectedDate = '';

        for (let i = 0; i < Math.min(10, aoa.length); i++) {
          const rowStr = (aoa[i] || []).join(' ').toUpperCase();
          if (rowStr.includes('DATA HARIAN GUDANG') || rowStr.includes('AYAM @ ANUGRAH') || rowStr.includes('AYAM  @ ANUGRAH')) {
            isGoogleSheetFormat = true;
          }
          const dateMatch = rowStr.match(/TANGGAL\s*:\s*([^,;]+)/i);
          if (dateMatch) {
            detectedDate = dateMatch[1].trim();
          }
        }

        if (!detectedDate) {
          detectedDate = '01 Nov 2026';
        }

        const parsedRows: ParsedWarehouseRow[] = [];

        if (isGoogleSheetFormat) {
          // Find row index containing header "NO" and "NAMA"
          let headerIdx = -1;
          for (let i = 0; i < Math.min(15, aoa.length); i++) {
            const rowUpper = (aoa[i] || []).map((c) => String(c || '').toUpperCase().trim());
            if (rowUpper.includes('NO') && rowUpper.includes('NAMA')) {
              headerIdx = i;
              break;
            }
          }

          if (headerIdx === -1) {
            headerIdx = 6; // default fallback
          }

          // Parse data rows starting after headerIdx
          for (let i = headerIdx + 1; i < aoa.length; i++) {
            const r = aoa[i] || [];
            const rowStr = r.join(' ').toUpperCase();

            // Skip sub-headers or summary rows
            if (rowStr.includes('BIJI') && rowStr.includes('KG')) continue;
            if (rowStr.includes('JUMLAH') && !r[1]) continue;
            if (String(r[1] || '').toUpperCase().trim() === 'JUMLAH') continue;

            const name = String(r[1] || '').trim();
            if (!name) continue;

            const no = Number(r[0]) || parsedRows.length + 1;
            const ekor = Number(r[2]) || 0;

            const ayamKg = Number(r[7]) || 0;
            const ayamHarga = Number(r[8]) || (ayamKg > 0 ? 25500 : 0);
            const ayamTotal = Number(r[9]) || Math.round(ayamKg * ayamHarga);

            const atiBiji = Number(r[10]) || 0;
            const atiHarga = Number(r[11]) || (atiBiji > 0 ? 1500 : 0);
            const atiTotal = Number(r[12]) || Math.round(atiBiji * atiHarga);

            const ususKg = Number(r[13]) || 0;
            const ususHarga = Number(r[14]) || (ususKg > 0 ? 15000 : 0);
            const ususTotal = Number(r[15]) || Math.round(ususKg * ususHarga);

            let grandTotal = Number(r[16]) || 0;
            if (grandTotal === 0) {
              grandTotal = ayamTotal + atiTotal + ususTotal;
            }

            const rawKet = String(r[17] || '').trim();
            const keterangan = rawKet.replace(/^ket:\s*/i, '').trim();

            parsedRows.push({
              no,
              customerName: name,
              customerCode: `#${String(no).padStart(2, '0')}`,
              ekor,
              ayamKg: Math.round(ayamKg * 10) / 10,
              ayamPrice: ayamHarga,
              ayamTotal,
              atiBiji,
              atiPrice: atiHarga,
              atiTotal,
              ususKg: Math.round(ususKg * 10) / 10,
              ususPrice: ususHarga,
              ususTotal,
              grandTotal,
              keterangan,
              status: 'BELUM LUNAS',
            });
          }
        } else {
          // Flat / generic tabular format
          // Check standard columns: Nama, Ekor, Kg, Harga, Total, Ati, Usus, dll
          const rawObjects: any[] = XLSX.utils.sheet_to_json(worksheet);

          rawObjects.forEach((obj, idx) => {
            const name = obj['Nama Pelanggan'] || obj['NAMA'] || obj['Nama'] || obj['Customer'] || obj['Pelanggan'];
            if (!name) return;

            const no = Number(obj['No'] || obj['NO'] || idx + 1);
            const ekor = Number(obj['Ekor'] || obj['EKOR'] || obj['Jumlah Ekor'] || 0);

            const ayamKg = Number(obj['Kg'] || obj['JMLH'] || obj['Berat'] || obj['Ayam Kg'] || 0);
            const ayamHarga = Number(obj['Harga'] || obj['HARGA'] || obj['Harga Ayam'] || 25500);
            const ayamTotal = Number(obj['Jumlah Ayam'] || obj['Total Ayam'] || ayamKg * ayamHarga);

            const atiBiji = Number(obj['Ati (bj)'] || obj['Ati'] || obj['ATI'] || obj['Biji Ati'] || 0);
            const atiHarga = Number(obj['Harga Ati'] || 1500);
            const atiTotal = Number(obj['Jumlah Ati'] || atiBiji * atiHarga);

            const ususKg = Number(obj['Usus (kg)'] || obj['Usus'] || obj['USUS'] || 0);
            const ususHarga = Number(obj['Harga Usus'] || 15000);
            const ususTotal = Number(obj['Jumlah Usus'] || ususKg * ususHarga);

            const grandTotal = Number(
              obj['Total'] ||
              obj['JUMLAH KESELURUHAN'] ||
              obj['Total Tagihan'] ||
              obj['Jumlah'] ||
              (ayamTotal + atiTotal + ususTotal)
            );

            const rawKet = String(obj['Keterangan'] || obj['KETERANGAN'] || obj['Catatan'] || obj['Ket'] || '').trim();
            const keterangan = rawKet.replace(/^ket:\s*/i, '').trim();

            parsedRows.push({
              no,
              customerName: String(name).trim(),
              customerCode: `#${String(no).padStart(2, '0')}`,
              ekor,
              ayamKg: Math.round(ayamKg * 10) / 10,
              ayamPrice: ayamHarga,
              ayamTotal,
              atiBiji,
              atiPrice: atiHarga,
              atiTotal,
              ususKg: Math.round(ususKg * 10) / 10,
              ususPrice: ususHarga,
              ususTotal,
              grandTotal,
              keterangan,
              status: 'BELUM LUNAS',
            });
          });
        }

        if (parsedRows.length === 0) {
          throw new Error('Tidak ada data pelanggan ayam yang valid ditemukan dalam file ini.');
        }

        // Convert parsed rows to AyamAnugrahReceipt[]
        const receipts: AyamAnugrahReceipt[] = parsedRows.map((r) => {
          const items: AyamReceiptLineItem[] = [];

          if (r.ayamKg > 0) {
            items.push({
              name: 'Ayam Gebrus',
              detailLabel: r.ekor > 0 ? `(${r.ekor} ekor)` : undefined,
              quantity: r.ayamKg,
              unit: 'kg',
              price: r.ayamPrice,
              total: r.ayamTotal,
            });
          }

          if (r.atiBiji > 0) {
            items.push({
              name: 'Ati',
              quantity: r.atiBiji,
              unit: 'bj',
              price: r.atiPrice,
              total: r.atiTotal,
            });
          }

          if (r.ususKg > 0) {
            items.push({
              name: 'Usus',
              quantity: r.ususKg,
              unit: 'kg',
              price: r.ususPrice,
              total: r.ususTotal,
            });
          }

          // If no specific item detected, fallback item
          if (items.length === 0) {
            items.push({
              name: 'Penjualan Karkas Ayam',
              quantity: 1,
              unit: 'paket',
              price: r.grandTotal,
              total: r.grandTotal,
            });
          }

          return {
            id: 'rcp_imp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            userId: 'guest',
            receiptNumber: `INV-AA-${String(r.no).padStart(2, '0')}`,
            date: detectedDate,
            customerName: r.customerName,
            customerCode: r.customerCode || `#${String(r.no).padStart(2, '0')}`,
            noteBox: r.keterangan ? `Ket: ${r.keterangan}` : undefined,
            items,
            totalAmount: r.grandTotal,
            status: r.status,
            createdAt: new Date().toISOString(),
          };
        });

        // Convert parsed rows to PoultryInvoiceItem[] for ExcelTableInput
        const invoiceItems: PoultryInvoiceItem[] = parsedRows.map((r, i) => ({
          id: 'inv_imp_' + (i + 1) + '_' + Date.now(),
          date: getTodayDateString(),
          customerName: r.customerName,
          productName: 'Ayam Gebrus Broiler',
          weightKg: r.ayamKg || 50,
          pricePerKg: r.ayamPrice || 25500,
          totalAmount: r.grandTotal,
          paymentTerms: 'Tempo 7 Hari (1 Minggu)',
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          notes: r.keterangan ? `[${r.keterangan}] ${r.ekor} ekor, Ati ${r.atiBiji} bj, Usus ${r.ususKg} kg` : `${r.ekor} ekor`,
          status: 'unpaid',
        }));

        // Totals calculation
        const totalEkor = parsedRows.reduce((s, r) => s + r.ekor, 0);
        const totalAyamKg = Math.round(parsedRows.reduce((s, r) => s + r.ayamKg, 0) * 10) / 10;
        const totalAyamTotal = parsedRows.reduce((s, r) => s + r.ayamTotal, 0);
        const totalAtiBiji = parsedRows.reduce((s, r) => s + r.atiBiji, 0);
        const totalAtiTotal = parsedRows.reduce((s, r) => s + r.atiTotal, 0);
        const totalUsusKg = Math.round(parsedRows.reduce((s, r) => s + r.ususKg, 0) * 10) / 10;
        const totalUsusTotal = parsedRows.reduce((s, r) => s + r.ususTotal, 0);
        const grandTotal = parsedRows.reduce((s, r) => s + r.grandTotal, 0);

        resolve({
          fileName: file.name,
          detectedDate,
          isGoogleSheetFormat,
          rows: parsedRows,
          receipts,
          invoiceItems,
          totals: {
            totalCustomers: parsedRows.length,
            totalEkor,
            totalAyamKg,
            totalAyamTotal,
            totalAtiBiji,
            totalAtiTotal,
            totalUsusKg,
            totalUsusTotal,
            grandTotal,
          },
        });
      } catch (err: any) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Gagal membaca file dari perangkat.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Downloads official blank Excel template matching Google Sheet layout
 */
export function downloadWarehouseExcelTemplate(format: 'xlsx' | 'csv') {
  const wb = XLSX.utils.book_new();
  const dateStr = '1 November 2026';

  const emptyRow = () => new Array(18).fill('');

  const grid: any[][] = [];
  const r0 = emptyRow();
  r0[0] = 'DATA HARIAN GUDANG';
  grid.push(r0);

  const r1 = emptyRow();
  r1[0] = '"AYAM  @ ANUGRAH"';
  grid.push(r1);

  grid.push(emptyRow());
  grid.push(emptyRow());

  const r4 = emptyRow();
  r4[0] = `TANGGAL : ${dateStr}`;
  r4[1] = dateStr;
  grid.push(r4);

  grid.push(emptyRow());

  const r6 = emptyRow();
  r6[0] = 'NO';
  r6[1] = 'NAMA';
  r6[2] = 'EKOR';
  r6[3] = 'AYAM GEBRUS';
  r6[7] = 'JMLH';
  r6[8] = 'HARGA';
  r6[9] = 'JUMLAH';
  r6[10] = 'ATI';
  r6[12] = 'JUMLAH';
  r6[13] = 'USUS';
  r6[15] = 'JUMLAH';
  r6[16] = 'JUMLAH';
  r6[17] = 'KETERANGAN';
  grid.push(r6);

  const r7 = emptyRow();
  r7[10] = 'BIJI';
  r7[11] = 'HARGA';
  r7[13] = 'KG';
  r7[14] = 'HARGA';
  r7[16] = 'KESELURUHAN';
  grid.push(r7);

  // Sample row 1
  const s1 = emptyRow();
  s1[0] = 1;
  s1[1] = 'Contoh Pelanggan 1';
  s1[2] = 30;
  s1[7] = 50.5;
  s1[8] = 25500;
  s1[9] = 1287750;
  s1[10] = 30;
  s1[11] = 1500;
  s1[12] = 45000;
  s1[13] = 5;
  s1[14] = 15000;
  s1[15] = 75000;
  s1[16] = 1407750;
  s1[17] = 'Pita Putih';
  grid.push(s1);

  const ws = XLSX.utils.aoa_to_sheet(grid);
  ws['!merges'] = [
    { s: { c: 0, r: 0 }, e: { c: 17, r: 0 } },
    { s: { c: 0, r: 1 }, e: { c: 17, r: 1 } },
    { s: { c: 0, r: 6 }, e: { c: 0, r: 7 } },
    { s: { c: 1, r: 6 }, e: { c: 1, r: 7 } },
    { s: { c: 2, r: 6 }, e: { c: 2, r: 7 } },
    { s: { c: 3, r: 6 }, e: { c: 6, r: 7 } },
    { s: { c: 7, r: 6 }, e: { c: 7, r: 7 } },
    { s: { c: 8, r: 6 }, e: { c: 8, r: 7 } },
    { s: { c: 9, r: 6 }, e: { c: 9, r: 7 } },
    { s: { c: 10, r: 6 }, e: { c: 11, r: 6 } },
    { s: { c: 12, r: 6 }, e: { c: 12, r: 7 } },
    { s: { c: 13, r: 6 }, e: { c: 14, r: 6 } },
    { s: { c: 15, r: 6 }, e: { c: 15, r: 7 } },
    { s: { c: 17, r: 6 }, e: { c: 17, r: 7 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Template Gudang');

  if (format === 'xlsx') {
    XLSX.writeFile(wb, 'Template_Excel_Gudang_Ayam_Anugrah.xlsx');
  } else {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Template_CSV_Gudang_Ayam_Anugrah.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
