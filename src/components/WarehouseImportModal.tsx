import React, { useState, useRef } from 'react';
import { AyamAnugrahReceipt } from '../types/index';
import {
  parseWarehouseExcelFile,
  ParsedWarehouseImportResult,
  downloadWarehouseExcelTemplate,
} from '../utils/excelImportWarehouse';
import { formatAngkaIndo, formatRupiah } from '../data/defaults';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Download,
  Layers,
  FileCheck,
  RotateCcw,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface WarehouseImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (
    importedReceipts: AyamAnugrahReceipt[],
    mode: 'replace' | 'append',
    syncToFinance: boolean
  ) => void;
}

export const WarehouseImportModal: React.FC<WarehouseImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParsedWarehouseImportResult | null>(null);

  // Import options
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [syncToFinance, setSyncToFinance] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    await processFile(selected);
  };

  const processFile = async (f: File) => {
    setFile(f);
    setParseError(null);
    setIsParsing(true);
    setParseResult(null);

    try {
      const result = await parseWarehouseExcelFile(f);
      setParseResult(result);
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || 'Gagal membaca dan memproses file Excel.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      processFile(dropped);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleConfirmImport = () => {
    if (!parseResult || parseResult.receipts.length === 0) return;
    onImportSuccess(parseResult.receipts, importMode, syncToFinance);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30">
              <Upload className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">
                Import File Excel / CSV Gudang Ayam Anugerah
              </h3>
              <p className="text-xs text-emerald-200/80">
                Otomatis membaca format Google Sheets & spreadsheet tabel penjualan ayam
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* If no file parsed yet -> Upload Dropzone */}
          {!parseResult && (
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-xs">
                  {isParsing ? (
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-8 h-8" />
                  )}
                </div>

                <h4 className="font-extrabold text-gray-900 text-sm sm:text-base">
                  {isParsing ? 'Sedang Membaca & Menganalisis File Excel...' : 'Tarik File Excel ke Sini atau Klik untuk Memilih'}
                </h4>
                <p className="text-xs text-gray-500 mt-1 max-w-md">
                  Mendukung file <strong>.xlsx</strong>, <strong>.xls</strong>, dan <strong>.csv</strong> dari Google Sheets atau Microsoft Excel.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <span className="px-2 py-1 text-[10px] font-bold bg-white text-emerald-800 rounded-lg border border-emerald-200 shadow-2xs">
                    Format Google Sheets (DATA HARIAN GUDANG)
                  </span>
                  <span className="px-2 py-1 text-[10px] font-bold bg-white text-emerald-800 rounded-lg border border-emerald-200 shadow-2xs">
                    Multi-item: Ekor, Kg, Ati, Usus
                  </span>
                  <span className="px-2 py-1 text-[10px] font-bold bg-white text-emerald-800 rounded-lg border border-emerald-200 shadow-2xs">
                    Format Flat / CSV Standar
                  </span>
                </div>
              </div>

              {parseError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <strong className="font-bold">Gagal Mengimpor:</strong> {parseError}
                    <div className="mt-1 text-[11px] text-rose-700">
                      Pastikan file memiliki kolom nama pelanggan, ekor, dan berat/jumlah. Anda dapat mengunduh contoh template di bawah.
                    </div>
                  </div>
                </div>
              )}

              {/* Template Download Card */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold text-gray-900">Belum punya format Excel yang pas?</div>
                    <div className="text-[11px] text-gray-500">
                      Download template kosong siap isi sesuai Google Sheets Ayam Anugerah
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => downloadWarehouseExcelTemplate('xlsx')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl font-bold text-emerald-700 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Template (.XLSX)</span>
                  </button>
                  <button
                    onClick={() => downloadWarehouseExcelTemplate('csv')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl font-bold text-gray-700 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Template (.CSV)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* When file is parsed successfully -> Preview & Confirmation */}
          {parseResult && (
            <div className="space-y-4">
              {/* File Info Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-emerald-950 text-sm">
                      {parseResult.fileName}
                    </div>
                    <div className="text-xs text-emerald-700 font-medium">
                      Tanggal: <strong>{parseResult.detectedDate}</strong> • {parseResult.isGoogleSheetFormat ? 'Format Resmi Google Sheets Terdeteksi' : 'Format Tabel Standar'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ganti File</span>
                </button>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Pelanggan Ditemukan</div>
                  <div className="text-base font-black text-gray-900 mt-0.5">
                    {parseResult.totals.totalCustomers} Struk
                  </div>
                  <div className="text-[10px] text-gray-500">{parseResult.totals.totalEkor} Ekor Total</div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">Ayam Gebrus</div>
                  <div className="text-base font-black text-emerald-700 mt-0.5 font-mono">
                    {formatAngkaIndo(parseResult.totals.totalAyamKg)} kg
                  </div>
                  <div className="text-[10px] text-gray-500">{formatRupiah(parseResult.totals.totalAyamTotal)}</div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-amber-600 uppercase">Ati & Usus</div>
                  <div className="text-base font-black text-amber-700 mt-0.5 font-mono">
                    {parseResult.totals.totalAtiBiji} bj • {formatAngkaIndo(parseResult.totals.totalUsusKg)} kg
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {formatRupiah(parseResult.totals.totalAtiTotal + parseResult.totals.totalUsusTotal)}
                  </div>
                </div>

                <div className="bg-emerald-600 text-white p-3 rounded-2xl shadow-xs">
                  <div className="text-[10px] font-bold text-emerald-100 uppercase">Grand Total Nilai</div>
                  <div className="text-base font-black font-mono mt-0.5">
                    {formatRupiah(parseResult.totals.grandTotal)}
                  </div>
                  <div className="text-[10px] text-emerald-200">Siap disimpan ke struk</div>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>Pratinjau Data yang Akan Diimpor ({parseResult.rows.length} Baris):</span>
                  <span className="text-[11px] text-gray-400 font-normal">Geser ke kanan untuk melihat rincian</span>
                </div>
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-100 text-gray-700 text-[10px] uppercase font-bold sticky top-0">
                      <tr>
                        <th className="py-2 px-3">No</th>
                        <th className="py-2 px-3">Pelanggan</th>
                        <th className="py-2 px-2 text-center">Ekor</th>
                        <th className="py-2 px-3 text-right">Ayam (Kg)</th>
                        <th className="py-2 px-3 text-right">Ati (bj)</th>
                        <th className="py-2 px-3 text-right">Usus (kg)</th>
                        <th className="py-2 px-3 text-right">Total Tagihan</th>
                        <th className="py-2 px-3">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                      {parseResult.rows.map((row) => (
                        <tr key={row.no} className="hover:bg-gray-50">
                          <td className="py-1.5 px-3 text-gray-500 font-semibold">{row.no}</td>
                          <td className="py-1.5 px-3 font-bold text-gray-900 font-sans">{row.customerName}</td>
                          <td className="py-1.5 px-2 text-center text-gray-700">{row.ekor || '-'}</td>
                          <td className="py-1.5 px-3 text-right text-emerald-800 font-semibold">
                            {row.ayamKg > 0 ? `${row.ayamKg} kg` : '-'}
                          </td>
                          <td className="py-1.5 px-3 text-right text-amber-800">
                            {row.atiBiji > 0 ? `${row.atiBiji} bj` : '-'}
                          </td>
                          <td className="py-1.5 px-3 text-right text-blue-800">
                            {row.ususKg > 0 ? `${row.ususKg} kg` : '-'}
                          </td>
                          <td className="py-1.5 px-3 text-right font-black text-purple-950">
                            {formatRupiah(row.grandTotal)}
                          </td>
                          <td className="py-1.5 px-3 text-gray-600 font-sans text-[10px]">
                            {row.keterangan ? (
                              <span className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 font-bold">
                                {row.keterangan}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import Options */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3 text-xs">
                <div className="font-bold text-gray-900">Opsi Penyimpanan Impor:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-emerald-500 transition-colors">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-bold text-gray-900">Ganti Seluruh Struk Saat Ini</div>
                      <div className="text-[11px] text-gray-500">
                        Mengosongkan struk lama dan memasukkan {parseResult.rows.length} data baru dari file Excel ini
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-emerald-500 transition-colors">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-bold text-gray-900">Gabungkan ke Struk yang Ada</div>
                      <div className="text-[11px] text-gray-500">
                        Menambahkan {parseResult.rows.length} struk baru ini ke daftar struk yang sudah tersimpan
                      </div>
                    </div>
                  </label>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={syncToFinance}
                    onChange={(e) => setSyncToFinance(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium text-gray-700">
                    Sinkronkan data ini otomatis ke <strong>Arus Kas Transaksi</strong> & <strong>Pengingat Tagihan Piutang</strong>
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Batal
          </button>

          {parseResult && (
            <button
              onClick={handleConfirmImport}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-emerald-600/25 active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Konfirmasi & Impor ({parseResult.rows.length} Struk)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
