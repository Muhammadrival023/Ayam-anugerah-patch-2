import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { exportToExcel, exportToCSV, parseImportFile, downloadTemplate } from '../utils/excelManager';
import { formatRupiah } from '../data/defaults';
import {
  FileSpreadsheet,
  Download,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
} from 'lucide-react';
import { Transaction } from '../types';

interface ExcelManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExcelManager: React.FC<ExcelManagerProps> = ({ isOpen, onClose }) => {
  const { transactions, importTransactions } = useFinance();

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Export State
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  );
  const [exportAll, setExportAll] = useState<boolean>(false);

  // Import State
  const [importedData, setImportedData] = useState<Omit<Transaction, 'id' | 'userId' | 'createdAt'>[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Transactions to export
  const exportList = useMemo(() => {
    if (exportAll) return transactions;
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth, exportAll]);

  const exportSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    exportList.forEach((t) => {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });
    return {
      count: exportList.length,
      income,
      expense,
      net: income - expense,
    };
  }, [exportList]);

  if (!isOpen) return null;

  const handleExportXLSX = () => {
    exportToExcel(exportList, {
      fileName: `Laporan_Keuangan_${exportAll ? 'Semua' : selectedMonth}.xlsx`,
    });
  };

  const handleExportCSV = () => {
    exportToCSV(exportList, `Transaksi_Keuangan_${exportAll ? 'Semua' : selectedMonth}.csv`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setImportSuccessCount(null);
    setFileName(file.name);

    try {
      const parsed = await parseImportFile(file);
      if (parsed.length === 0) {
        setErrorMsg('Tidak ditemukan baris transaksi yang valid dalam file ini.');
      } else {
        setImportedData(parsed);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal membaca file. Pastikan format kolom sesuai template Excel/CSV.');
    }
  };

  const handleConfirmImport = async () => {
    if (importedData.length === 0) return;

    setIsImporting(true);
    try {
      const count = await importTransactions(importedData);
      setImportSuccessCount(count);
      setImportedData([]);
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal menyimpan transaksi ke database.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Pusat Laporan Excel & CSV</h3>
              <p className="text-xs text-gray-500">Ekspor laporan bulanan dan impor data langsung</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 px-6">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'export'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Laporan Bulanan</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'import'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Impor Data Transaksi</span>
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {activeTab === 'export' ? (
            /* EXPORT TAB */
            <div className="space-y-6">
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 text-emerald-950 text-xs space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Format Standar Profesional
                </span>
                <p className="text-emerald-800">
                  File Excel (.xlsx) akan dibuat dengan 2 lembar kerja (Sheet): <strong>Ringkasan Analitik</strong> dan <strong>Daftar Detail Transaksi</strong> lengkap dengan nomor struk.
                </p>
              </div>

              {/* Month Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>Pilih Bulan Laporan</span>
                  </label>
                  <input
                    type="month"
                    disabled={exportAll}
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:outline-emerald-500 disabled:opacity-40"
                  />
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={exportAll}
                      onChange={(e) => setExportAll(e.target.checked)}
                      className="rounded-sm text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span className="text-xs font-medium text-gray-700">
                      Ekspor Seluruh Transaksi ({transactions.length} data)
                    </span>
                  </label>
                </div>
              </div>

              {/* Preview Cards */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Pratinjau Data yang akan Diekspor:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-gray-100">
                    <div className="text-gray-400 text-[10px]">Total Transaksi</div>
                    <div className="font-extrabold text-sm text-gray-900">{exportSummary.count} item</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-100">
                    <div className="text-gray-400 text-[10px]">Total Pemasukan</div>
                    <div className="font-extrabold text-sm text-emerald-600">{formatRupiah(exportSummary.income)}</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-100">
                    <div className="text-gray-400 text-[10px]">Total Pengeluaran</div>
                    <div className="font-extrabold text-sm text-rose-600">{formatRupiah(exportSummary.expense)}</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-100">
                    <div className="text-gray-400 text-[10px]">Arus Kas Bersih</div>
                    <div className="font-extrabold text-sm text-teal-700">{formatRupiah(exportSummary.net)}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={handleExportXLSX}
                  disabled={exportList.length === 0}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-40"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Unduh File Excel (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  disabled={exportList.length === 0}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-900 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md disabled:opacity-40"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh File CSV (.csv)</span>
                </button>
              </div>
            </div>
          ) : (
            /* IMPORT TAB */
            <div className="space-y-6">
              {/* Template download guide */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs">
                <div>
                  <h4 className="font-bold text-indigo-900">Format Template Impor</h4>
                  <p className="text-indigo-700 text-[11px]">
                    Gunakan template kami untuk memudahkan impor dari Excel atau CSV tanpa kendala.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadTemplate('xlsx')}
                    className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg font-semibold hover:bg-indigo-50 transition-colors text-[11px]"
                  >
                    Template .XLSX
                  </button>
                  <button
                    onClick={() => downloadTemplate('csv')}
                    className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg font-semibold hover:bg-indigo-50 transition-colors text-[11px]"
                  >
                    Template .CSV
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-gray-50/50 transition-colors relative">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-800">
                  {fileName ? `File Terpilih: ${fileName}` : 'Pilih atau Geser File Excel (.xlsx) / CSV di Sini'}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Mendukung file spreadsheet Microsoft Excel atau format comma-separated
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {importSuccessCount !== null && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>
                    Berhasil mengimpor <strong>{importSuccessCount}</strong> transaksi ke sistem FinTrack Pro!
                  </span>
                </div>
              )}

              {/* Preview Imported Rows */}
              {importedData.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-800">
                      Pratinjau Data ({importedData.length} baris siap disimpan):
                    </span>
                    <button
                      onClick={() => setImportedData([])}
                      className="text-rose-600 hover:underline text-[11px]"
                    >
                      Batalkan
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0">
                        <tr>
                          <th className="p-2">Tanggal</th>
                          <th className="p-2">Tipe</th>
                          <th className="p-2">Kategori</th>
                          <th className="p-2">Deskripsi</th>
                          <th className="p-2 text-right">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importedData.slice(0, 10).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="p-2">{row.date}</td>
                            <td className="p-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  row.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {row.type === 'income' ? 'Masuk' : 'Keluar'}
                              </span>
                            </td>
                            <td className="p-2">{row.category}</td>
                            <td className="p-2 max-w-[150px] truncate">{row.description}</td>
                            <td className="p-2 text-right font-bold">{formatRupiah(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {importedData.length > 10 && (
                    <p className="text-[10px] text-gray-400 text-center">
                      + {importedData.length - 10} baris lainnya...
                    </p>
                  )}

                  <button
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{isImporting ? 'Sedang Memproses...' : `Simpan ${importedData.length} Transaksi Sekarang`}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
