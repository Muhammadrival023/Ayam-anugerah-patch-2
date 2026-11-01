import React, { useRef, useState } from 'react';
import { Transaction } from '../types';
import { formatRupiah } from '../data/defaults';
import {
  Printer,
  X,
  CheckCircle,
  Copy,
  FileText,
  Download,
  ExternalLink,
  Receipt,
  ChevronDown,
} from 'lucide-react';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);

  if (!transaction) return null;

  const isIncome = transaction.type === 'income';

  // Build clean thermal receipt HTML string
  const generateThermalHtml = (): string => {
    return `
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-size: 15px; font-weight: bold; letter-spacing: 1px;">AYAM ANUGERAH</div>
        <div style="font-size: 10px; color: #333;">SUPPLIER AYAM POTONG & KARKAS</div>
        <div style="font-size: 9px; color: #666;">Surat Jalan & Bukti Pembayaran Resmi</div>
      </div>
      <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
      <div style="font-size: 10px; line-height: 1.4;">
        <div style="display: flex; justify-content: space-between;">
          <span>No. Struk</span>
          <span style="font-weight: bold;">${transaction.receiptNumber}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Tanggal</span>
          <span>${transaction.date}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Waktu Catat</span>
          <span>${new Date(transaction.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Metode Bayar</span>
          <span style="font-weight: bold;">${transaction.paymentMethod}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Jenis Transaksi</span>
          <span style="font-weight: bold;">${isIncome ? 'PEMASUKAN' : 'PENGELUARAN'}</span>
        </div>
      </div>
      <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
      <div style="margin: 6px 0; font-size: 11px;">
        <div style="font-weight: bold;">${transaction.description}</div>
        <div style="font-size: 10px; color: #444;">Kategori: ${transaction.category}</div>
        ${transaction.note ? `<div style="font-size: 9px; font-style: italic; color: #555; margin-top: 3px;">Catatan: ${transaction.note}</div>` : ''}
      </div>
      <div style="border-bottom: 2px dashed #000; margin: 8px 0;"></div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: bold;">
        <span>TOTAL ${isIncome ? 'MASUK' : 'BAYAR'}</span>
        <span style="font-size: 14px;">${isIncome ? '+' : '-'} ${formatRupiah(transaction.amount)}</span>
      </div>
      <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>
      <div style="text-align: center; margin-top: 8px; font-size: 9px;">
        <div style="font-weight: bold; padding: 2px 6px; border: 1px solid #000; display: inline-block; margin-bottom: 4px;">
          TERCATAT & TERSINKRONISASI
        </div>
        <div style="display: flex; justify-content: center; height: 28px; gap: 2px; margin: 4px 0;">
          ${[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 2, 1, 3, 2, 1, 4, 1]
            .map((w) => `<div style="background: #000; width: ${w}px; height: 100%;"></div>`)
            .join('')}
        </div>
        <div style="letter-spacing: 2px; color: #555;">${transaction.receiptNumber}</div>
        <div style="margin-top: 6px; color: #666; font-size: 8px; line-height: 1.2;">
          Simpan bukti fisik ini sebagai arsip tagihan dan pengiriman resmi Ayam Anugerah.
        </div>
      </div>
    `;
  };

  // Robust printing using hidden iframe
  const handlePrint = () => {
    setIsPrinting(true);

    try {
      let iframe = document.getElementById('receipt-print-frame') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'receipt-print-frame';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.zIndex = '-9999';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Struk_${transaction.receiptNumber}</title>
              <style>
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
                body {
                  font-family: 'Courier New', Courier, monospace;
                  width: 72mm;
                  margin: 0 auto;
                  padding: 8px 4px;
                  background: #fff;
                  color: #000;
                  box-sizing: border-box;
                }
                * {
                  box-sizing: border-box;
                }
              </style>
            </head>
            <body>
              ${generateThermalHtml()}
              <script>
                window.onload = function() {
                  window.focus();
                  window.print();
                };
              </script>
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (err) {
            console.warn('Iframe print error, falling back to window.print', err);
            window.print();
          } finally {
            setIsPrinting(false);
          }
        }, 350);
      } else {
        window.print();
        setIsPrinting(false);
      }
    } catch (e) {
      console.warn('Printing error:', e);
      window.print();
      setIsPrinting(false);
    }
  };

  // Download printable standalone HTML receipt
  const handleDownloadHtml = () => {
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Struk_${transaction.receiptNumber}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 80mm;
              margin: 20px auto;
              padding: 16px;
              border: 1px solid #ccc;
              background: #fff;
              color: #000;
            }
          </style>
        </head>
        <body>
          ${generateThermalHtml()}
          <div style="text-align: center; margin-top: 15px;">
            <button onclick="window.print()" style="padding: 6px 12px; font-weight: bold; cursor: pointer;">Cetak Struk Sekarang</button>
          </div>
        </body>
      </html>
    `;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Struk_${transaction.receiptNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setIsDownloadMenuOpen(false);
  };

  const handleDownloadTxt = () => {
    const text = `
=== AYAM ANUGERAH - BUKTI TRANSAKSI ===
No. Struk   : ${transaction.receiptNumber}
Tanggal     : ${transaction.date}
Tipe        : ${transaction.type === 'income' ? 'PEMASUKAN' : 'PENGELUARAN'}
Kategori    : ${transaction.category}
Deskripsi   : ${transaction.description}
Metode      : ${transaction.paymentMethod}
Jumlah      : ${formatRupiah(transaction.amount)}
Catatan     : ${transaction.note || '-'}
Status      : TERVERIFIKASI & TERCATAT RESMI
=======================================
`.trim();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Struk_${transaction.receiptNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setIsDownloadMenuOpen(false);
  };

  const handleCopyText = () => {
    const text = `
=== AYAM ANUGERAH - BUKTI TRANSAKSI ===
No. Struk   : ${transaction.receiptNumber}
Tanggal     : ${transaction.date}
Tipe        : ${transaction.type === 'income' ? 'PEMASUKAN' : 'PENGELUARAN'}
Kategori    : ${transaction.category}
Deskripsi   : ${transaction.description}
Metode      : ${transaction.paymentMethod}
Jumlah      : ${formatRupiah(transaction.amount)}
Catatan     : ${transaction.note || '-'}
Status      : TERVERIFIKASI & TERCATAT RESMI
=======================================
`.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="receipt-modal-wrapper"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none">
        {/* Modal Header (Hidden on Print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Cetak Surat Jalan / Struk</h3>
              <p className="text-xs text-gray-500">Bukti fisik resmi Ayam Anugerah</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Area */}
        <div className="p-6 overflow-y-auto max-h-[75vh] print:max-h-none print:p-0">
          <div
            ref={receiptRef}
            id="printable-receipt"
            className="receipt-paper mx-auto w-full max-w-xs p-6 bg-white border border-gray-200 rounded-2xl shadow-xs text-gray-900 font-mono text-xs relative print:border-none print:shadow-none print:p-2"
          >
            {/* Top Sawtooth Edge styling */}
            <div className="text-center pb-4 border-b border-dashed border-gray-300">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-50 text-amber-700 mb-2 print:border print:border-gray-800">
                <Receipt className="w-5 h-5" />
              </div>
              <h2 className="text-base font-extrabold tracking-wider uppercase text-gray-900">
                AYAM ANUGERAH
              </h2>
              <p className="text-[10px] text-gray-500 font-sans font-bold">
                SUPPLIER AYAM POTONG & KARKAS
              </p>
              <p className="text-[10px] text-gray-400">Surat Jalan & Bukti Pembayaran Sah</p>
            </div>

            {/* Receipt Meta */}
            <div className="py-3 border-b border-dashed border-gray-300 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">No. Struk</span>
                <span className="font-semibold text-gray-900">{transaction.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tanggal</span>
                <span className="font-semibold text-gray-900">{transaction.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Waktu Catat</span>
                <span className="text-gray-700">
                  {new Date(transaction.createdAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  WIB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Metode Bayar</span>
                <span className="font-medium text-gray-900">{transaction.paymentMethod}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Jenis</span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-sm uppercase ${
                    isIncome
                      ? 'bg-emerald-100 text-emerald-800 print:border print:border-black'
                      : 'bg-rose-100 text-rose-800 print:border print:border-black'
                  }`}
                >
                  {isIncome ? 'PEMASUKAN' : 'PENGELUARAN'}
                </span>
              </div>
            </div>

            {/* Item Details */}
            <div className="py-4 border-b border-dashed border-gray-300">
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-bold text-sm text-gray-900 break-words max-w-[190px]">
                  {transaction.description}
                </span>
              </div>
              <div className="flex justify-between text-gray-500 text-[11px]">
                <span>Kategori: {transaction.category}</span>
              </div>
              {transaction.note && (
                <div className="mt-2 p-2 bg-gray-50 rounded-md text-[10px] text-gray-600 italic border border-gray-100 print:bg-white print:border-gray-300">
                  Catatan: {transaction.note}
                </div>
              )}
            </div>

            {/* Total Section */}
            <div className="py-4 border-b-2 border-dashed border-gray-400">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="uppercase text-gray-700">TOTAL</span>
                <span
                  className={`text-base font-extrabold ${
                    isIncome ? 'text-emerald-600 print:text-black' : 'text-rose-600 print:text-black'
                  }`}
                >
                  {isIncome ? '+' : '-'} {formatRupiah(transaction.amount)}
                </span>
              </div>
            </div>

            {/* Verification Badge & Barcode */}
            <div className="pt-4 text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-semibold border border-emerald-200 print:border-gray-800 print:text-gray-900">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>TERCATAT & TERSINKRON RESMI</span>
              </div>

              {/* Barcode visualization */}
              <div className="pt-2 flex flex-col items-center">
                <div className="flex items-center gap-[2px] h-9 px-4 justify-center">
                  {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 2, 1, 3, 2, 1, 4, 1].map((w, i) => (
                    <div
                      key={i}
                      className="bg-gray-900 h-full"
                      style={{ width: `${w}px` }}
                    />
                  ))}
                </div>
                <span className="text-[9px] tracking-widest text-gray-400 mt-1">
                  {transaction.receiptNumber}
                </span>
              </div>

              <p className="text-[10px] text-gray-400 leading-relaxed pt-1">
                Simpan bukti fisik ini sebagai arsip tagihan dan pengiriman resmi Ayam Anugerah.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions (Hidden on Print) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-4 border-t border-gray-100 bg-gray-50 print:hidden">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5 text-gray-500" />
              <span>{copied ? 'Tersalin!' : 'Salin'}</span>
            </button>

            {/* Menu Download Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Menu Download</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDownloadMenuOpen && (
                <div className="absolute left-0 bottom-full mb-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 z-50 text-xs">
                  <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100 mb-1">
                    Format Download
                  </div>
                  <button
                    onClick={handleDownloadTxt}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-xl hover:bg-purple-50 text-gray-700 hover:text-purple-800 transition-colors"
                  >
                    <Receipt className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <div className="font-bold">Download Nota (.TXT)</div>
                      <div className="text-[10px] text-gray-400">Thermal printer bluetooth & arsip</div>
                    </div>
                  </button>
                  <button
                    onClick={handleDownloadHtml}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-xl hover:bg-blue-50 text-gray-700 hover:text-blue-800 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="font-bold">Download Dokumen (.HTML)</div>
                      <div className="text-[10px] text-gray-400">File struk siap cetak offline</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsDownloadMenuOpen(false);
                      handlePrint();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-xl hover:bg-amber-50 text-gray-700 hover:text-amber-800 transition-colors"
                  >
                    <Printer className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-bold">Cetak / Simpan PDF (80mm)</div>
                      <div className="text-[10px] text-gray-400">Dialog cetak & save PDF POS</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-xl transition-all shadow-md shadow-amber-600/20 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Mempersiapkan...' : 'Cetak Struk Sekarang'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
