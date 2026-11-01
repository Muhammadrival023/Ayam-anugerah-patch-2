import React, { useState } from 'react';
import { AyamAnugrahReceipt } from '../types/index';
import {
  parseReceiptToWarehouseRow,
  exportToExcelGoogleSheetFormat,
  exportToCsvGoogleSheetFormat,
  WarehouseSheetRow,
} from '../utils/receiptDownloader';
import { formatAngkaIndo, formatRupiah } from '../data/defaults';
import {
  X,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  ExternalLink,
  Table,
  CheckCircle,
} from 'lucide-react';

interface WarehouseGoogleSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: AyamAnugrahReceipt[];
}

export const WarehouseGoogleSheetModal: React.FC<WarehouseGoogleSheetModalProps> = ({
  isOpen,
  onClose,
  receipts,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const rows: WarehouseSheetRow[] = receipts.map((r, i) =>
    parseReceiptToWarehouseRow(r, i)
  );

  const totalEkor = rows.reduce((s, r) => s + r.ekor, 0);
  const totalAyamKg = Math.round(rows.reduce((s, r) => s + r.ayamKg, 0) * 10) / 10;
  const totalAyamTotal = rows.reduce((s, r) => s + r.ayamTotal, 0);
  const totalAtiBiji = rows.reduce((s, r) => s + r.atiBiji, 0);
  const totalAtiTotal = rows.reduce((s, r) => s + r.atiTotal, 0);
  const totalUsusKg = Math.round(rows.reduce((s, r) => s + r.ususKg, 0) * 10) / 10;
  const totalUsusTotal = rows.reduce((s, r) => s + r.ususTotal, 0);
  const grandTotal = rows.reduce((s, r) => s + r.grandTotal, 0);

  const dateLabel = receipts.length > 0 ? receipts[0].date : '1 November 2026';

  const handleDownloadXlsx = () => {
    exportToExcelGoogleSheetFormat(receipts, dateLabel);
  };

  const handleDownloadCsv = () => {
    exportToCsvGoogleSheetFormat(receipts, dateLabel);
  };

  const handleCopyClipboard = () => {
    const header1 = ['NO', 'NAMA', 'EKOR', 'JMLH KG', 'HARGA AYAM', 'JUMLAH AYAM', 'ATI BIJI', 'HARGA ATI', 'JUMLAH ATI', 'USUS KG', 'HARGA USUS', 'JUMLAH USUS', 'JUMLAH KESELURUHAN', 'KETERANGAN'].join('\t');
    const dataLines = rows.map((r) =>
      [
        r.no,
        r.customerName,
        r.ekor,
        r.ayamKg,
        r.ayamPrice,
        r.ayamTotal,
        r.atiBiji || '',
        r.atiPrice || '',
        r.atiTotal || '',
        r.ususKg || '',
        r.ususPrice || '',
        r.ususTotal || '',
        r.grandTotal,
        r.keterangan || '',
      ].join('\t')
    );
    const summaryLine = ['', 'JUMLAH', totalEkor, totalAyamKg, '', totalAyamTotal, totalAtiBiji, '', totalAtiTotal, totalUsusKg, '', totalUsusTotal, grandTotal, ''].join('\t');

    const tsv = [
      'DATA HARIAN GUDANG - AYAM @ ANUGRAH',
      `TANGGAL : ${dateLabel}`,
      '',
      header1,
      ...dataLines,
      summaryLine,
    ].join('\n');

    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-black text-lg sm:text-xl tracking-tight flex items-center gap-2">
                  DATA HARIAN GUDANG — AYAM @ ANUGRAH
                  <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 rounded-full">
                    Format Google Sheets
                  </span>
                </h3>
                <p className="text-xs text-emerald-200/80 font-mono">
                  TANGGAL : {dateLabel} • {rows.length} Data Pelanggan Tercatat
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://docs.google.com/spreadsheets/d/1KpYPQkiP8coTO2UovIskkfPBncQiAZLY0a9f9if0uQw/edit?usp=drivesdk"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
              title="Buka Referensi Google Sheets"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Link Spreadsheet</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick KPI Stat Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-gray-50/80 border-b border-gray-100 text-xs shrink-0">
          <div className="bg-white p-3 rounded-2xl border border-gray-200/70 shadow-2xs">
            <div className="text-[10px] font-bold text-gray-500 uppercase">Ayam Gebrus ({totalEkor} Ekor)</div>
            <div className="text-sm font-black text-emerald-700 font-mono mt-0.5">
              {formatAngkaIndo(totalAyamKg)} kg
            </div>
            <div className="text-[11px] font-semibold text-gray-700 mt-0.5">
              {formatRupiah(totalAyamTotal)}
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-gray-200/70 shadow-2xs">
            <div className="text-[10px] font-bold text-gray-500 uppercase">Ati Ampela</div>
            <div className="text-sm font-black text-amber-700 font-mono mt-0.5">
              {formatAngkaIndo(totalAtiBiji)} biji
            </div>
            <div className="text-[11px] font-semibold text-gray-700 mt-0.5">
              {formatRupiah(totalAtiTotal)}
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-gray-200/70 shadow-2xs">
            <div className="text-[10px] font-bold text-gray-500 uppercase">Usus Ayam</div>
            <div className="text-sm font-black text-blue-700 font-mono mt-0.5">
              {formatAngkaIndo(totalUsusKg)} kg
            </div>
            <div className="text-[11px] font-semibold text-gray-700 mt-0.5">
              {formatRupiah(totalUsusTotal)}
            </div>
          </div>

          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 shadow-2xs">
            <div className="text-[10px] font-bold text-emerald-800 uppercase">Total Keseluruhan</div>
            <div className="text-base font-black text-emerald-950 font-mono mt-0.5">
              {formatRupiah(grandTotal)}
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5 font-medium">
              Formula: J + M + P
            </div>
          </div>
        </div>

        {/* Scrollable Spreadsheet Table */}
        <div className="flex-1 overflow-auto p-4 bg-white">
          <div className="min-w-[950px] border border-gray-300 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full border-collapse text-[11px] font-mono">
              {/* Multi-Level Header matching Google Sheets */}
              <thead>
                <tr className="bg-gray-100 text-gray-900 border-b border-gray-300 font-bold text-center">
                  <th rowSpan={2} className="border-r border-gray-300 px-2 py-2 w-10">NO</th>
                  <th rowSpan={2} className="border-r border-gray-300 px-3 py-2 text-left w-36">NAMA</th>
                  <th rowSpan={2} className="border-r border-gray-300 px-2 py-2 w-16">EKOR</th>
                  <th colSpan={3} className="border-r border-gray-300 px-3 py-1 bg-emerald-50 text-emerald-900 font-extrabold">
                    AYAM GEBRUS
                  </th>
                  <th colSpan={3} className="border-r border-gray-300 px-3 py-1 bg-amber-50 text-amber-900 font-extrabold">
                    ATI
                  </th>
                  <th colSpan={3} className="border-r border-gray-300 px-3 py-1 bg-blue-50 text-blue-900 font-extrabold">
                    USUS
                  </th>
                  <th rowSpan={2} className="border-r border-gray-300 px-3 py-2 bg-purple-50 text-purple-950 font-extrabold w-32">
                    JUMLAH<br />KESELURUHAN
                  </th>
                  <th rowSpan={2} className="px-3 py-2 text-left w-32">KETERANGAN</th>
                </tr>
                <tr className="bg-gray-50 text-gray-700 border-b border-gray-300 text-[10px]">
                  {/* Ayam Gebrus Sub-headers */}
                  <th className="border-r border-gray-300 px-2 py-1 bg-emerald-50/70">JMLH (KG)</th>
                  <th className="border-r border-gray-300 px-2 py-1 bg-emerald-50/70">HARGA</th>
                  <th className="border-r border-gray-300 px-2 py-1 bg-emerald-100/70 font-bold">JUMLAH</th>

                  {/* Ati Sub-headers */}
                  <th className="border-r border-gray-300 px-2 py-1 bg-amber-50/70">BIJI</th>
                  <th className="border-r border-gray-300 px-2 py-1 bg-amber-50/70">HARGA</th>
                  <th className="border-r border-gray-300 px-2 py-1 bg-amber-100/70 font-bold">JUMLAH</th>

                  {/* Usus Sub-headers */}
                  <th className="border-r border-gray-300 px-2 py-1 bg-blue-50/70">KG</th>
                  <th className="border-r border-gray-300 px-2 py-1 bg-blue-50/70">HARGA</th>
                  <th className="border-r border-gray-300 px-2 py-1 bg-blue-100/70 font-bold">JUMLAH</th>
                </tr>
              </thead>

              {/* Data Rows */}
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.no}
                    className={`border-b border-gray-200 hover:bg-gray-50/80 transition-colors ${
                      idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'
                    }`}
                  >
                    <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-500 font-semibold">
                      {row.no}
                    </td>
                    <td className="border-r border-gray-200 px-3 py-1.5 font-bold text-gray-900">
                      {row.customerName}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-700">
                      {row.ekor || '-'}
                    </td>

                    {/* Ayam Gebrus */}
                    <td className="border-r border-gray-200 px-2 py-1.5 text-right font-medium">
                      {row.ayamKg > 0 ? String(row.ayamKg).replace('.', ',') : '-'}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-1.5 text-right text-gray-600">
                      {row.ayamPrice > 0 ? `Rp ${formatAngkaIndo(row.ayamPrice)}` : '-'}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-1.5 text-right font-bold text-emerald-700 bg-emerald-50/30">
                      Rp {formatAngkaIndo(row.ayamTotal)}
                    </td>

                    {/* Ati */}
                    <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-700">
                      {row.atiBiji > 0 ? row.atiBiji : '-'}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-1.5 text-right text-gray-600">
                      {row.atiPrice > 0 ? `Rp ${formatAngkaIndo(row.atiPrice)}` : '-'}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-1.5 text-right font-bold text-amber-700 bg-amber-50/30">
                      {row.atiTotal > 0 ? `Rp ${formatAngkaIndo(row.atiTotal)}` : 'Rp -'}
                    </td>

                    {/* Usus */}
                    <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-700">
                      {row.ususKg > 0 ? String(row.ususKg).replace('.', ',') : '-'}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-1.5 text-right text-gray-600">
                      {row.ususPrice > 0 ? `Rp ${formatAngkaIndo(row.ususPrice)}` : '-'}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-1.5 text-right font-bold text-blue-700 bg-blue-50/30">
                      {row.ususTotal > 0 ? `Rp ${formatAngkaIndo(row.ususTotal)}` : 'Rp -'}
                    </td>

                    {/* Total Keseluruhan */}
                    <td className="border-r border-gray-200 px-2 py-1.5 text-right font-black text-purple-900 bg-purple-50/40">
                      Rp {formatAngkaIndo(row.grandTotal)}
                    </td>

                    {/* Keterangan */}
                    <td className="px-3 py-1.5 text-left text-gray-700">
                      {row.keterangan ? (
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-800 rounded border border-gray-300">
                          {row.keterangan}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Total Footer Row */}
              <tfoot>
                <tr className="bg-gray-200/90 text-gray-900 font-extrabold border-t-2 border-gray-400">
                  <td className="border-r border-gray-300 px-2 py-2 text-center text-gray-500"></td>
                  <td className="border-r border-gray-300 px-3 py-2 text-left font-black tracking-wider">
                    JUMLAH
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-center font-bold">
                    {totalEkor}
                  </td>

                  {/* Ayam Gebrus Totals */}
                  <td className="border-r border-gray-300 px-2 py-2 text-right">
                    {String(totalAyamKg).replace('.', ',')}
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-center text-gray-400">
                    -
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-right text-emerald-800 bg-emerald-100/50">
                    Rp {formatAngkaIndo(totalAyamTotal)}
                  </td>

                  {/* Ati Totals */}
                  <td className="border-r border-gray-300 px-2 py-2 text-center">
                    {totalAtiBiji}
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-center text-gray-400">
                    -
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-right text-amber-800 bg-amber-100/50">
                    Rp {formatAngkaIndo(totalAtiTotal)}
                  </td>

                  {/* Usus Totals */}
                  <td className="border-r border-gray-300 px-2 py-2 text-center">
                    {String(totalUsusKg).replace('.', ',')}
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-center text-gray-400">
                    -
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-right text-blue-800 bg-blue-100/50">
                    Rp {formatAngkaIndo(totalUsusTotal)}
                  </td>

                  {/* Grand Total */}
                  <td className="border-r border-gray-300 px-2 py-2 text-right text-purple-950 font-black text-xs bg-purple-100/80">
                    Rp {formatAngkaIndo(grandTotal)}
                  </td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Modal Action Bar */}
        <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Format tabel, rumus perkalian harga, dan rumus SUM terpasang otomatis.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopyClipboard}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Tabel (TSV)'}</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              title="Download file CSV format Google Sheets"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV (.CSV)</span>
            </button>

            <button
              onClick={handleDownloadXlsx}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-emerald-600/25 active:scale-95"
              title="Download file Excel (.xlsx) dengan multi-level headers dan formula lengkap"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel Resmi (.XLSX)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
