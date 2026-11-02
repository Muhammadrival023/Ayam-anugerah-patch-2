import React, { useState, useEffect } from 'react';
import { AyamAnugrahReceipt, AyamReceiptLineItem } from '../types';
import { SAMPLE_AYAM_RECEIPTS, formatAngkaIndo, formatRupiah, getTodayDateString } from '../data/defaults';
import {
  Printer,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Share2,
  Search,
  Filter,
  Copy,
  Receipt,
  FileSpreadsheet,
  Send,
  X,
  AlertTriangle,
  Download,
  ChevronDown,
  Image as ImageIcon,
  FileText,
  Check,
  RotateCcw,
  CheckSquare,
  Square,
  Table,
  Upload,
} from 'lucide-react';
import {
  downloadReceiptAsPng,
  downloadReceiptAsTxt,
  downloadReceiptAsCsv,
  downloadAllReceiptsAsCsv,
  downloadAllReceiptsAsTxt,
  formatReceiptAsText,
  exportToExcelGoogleSheetFormat,
  exportToCsvGoogleSheetFormat,
} from '../utils/receiptDownloader';
import { useFinance } from '../context/FinanceContext';
import { WarehouseGoogleSheetModal } from './WarehouseGoogleSheetModal';
import { WarehouseImportModal } from './WarehouseImportModal';

interface AyamReceiptGalleryProps {
  onOpenClearModal: () => void;
}

export const AyamReceiptGallery: React.FC<AyamReceiptGalleryProps> = ({ onOpenClearModal }) => {
  const {
    receipts,
    addReceipt,
    updateReceipt,
    deleteReceipt,
    deleteReceiptsBatch,
    clearReceipts,
    restoreSampleReceipts,
    importReceipts,
  } = useFinance();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BELUM LUNAS' | 'LUNAS'>('ALL');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<AyamAnugrahReceipt | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Download menu states
  const [activeDownloadMenuId, setActiveDownloadMenuId] = useState<string | null>(null);
  const [isBatchDownloadMenuOpen, setIsBatchDownloadMenuOpen] = useState(false);
  const [copiedReceiptId, setCopiedReceiptId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<{ id: string; format: string } | null>(null);

  // Delete Menu & Action States
  const [isDeleteMenuOpen, setIsDeleteMenuOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<AyamAnugrahReceipt | null>(null);
  const [bulkDeleteConfig, setBulkDeleteConfig] = useState<{
    type: 'selected' | 'belum_lunas' | 'lunas' | 'all';
    title: string;
    description: string;
    count: number;
  } | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // New/Edit Receipt Form States
  const [formDate, setFormDate] = useState('01 Nov 2026');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerCode, setFormCustomerCode] = useState('');
  const [formNoteBox, setFormNoteBox] = useState('');
  const [formStatus, setFormStatus] = useState<'BELUM LUNAS' | 'LUNAS'>('BELUM LUNAS');
  const [formItems, setFormItems] = useState<AyamReceiptLineItem[]>([
    { name: 'Ayam Gebrus', detailLabel: '(30 ekor)', quantity: 50.0, unit: 'kg', price: 25500, total: 1275000 },
    { name: 'Ati', quantity: 30, unit: 'bj', price: 1500, total: 45000 },
    { name: 'Usus', quantity: 5, unit: 'kg', price: 15000, total: 75000 },
  ]);

  // Calculations
  const filteredReceipts = receipts.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = r.customerName.toLowerCase().includes(term);
      const matchCode = r.customerCode ? r.customerCode.toLowerCase().includes(term) : false;
      const matchNote = r.noteBox ? r.noteBox.toLowerCase().includes(term) : false;
      if (!matchName && !matchCode && !matchNote) return false;
    }
    return true;
  });

  const totalOutstanding = receipts
    .filter((r) => r.status === 'BELUM LUNAS')
    .reduce((sum, r) => sum + r.totalAmount, 0);

  const totalPaid = receipts
    .filter((r) => r.status === 'LUNAS')
    .reduce((sum, r) => sum + r.totalAmount, 0);

  // Toggle status
  const handleToggleStatus = async (id: string) => {
    const current = receipts.find((r) => r.id === id);
    if (!current) return;
    const newStatus = current.status === 'BELUM LUNAS' ? 'LUNAS' : 'BELUM LUNAS';
    await updateReceipt(id, { status: newStatus });
    showToast(`Status struk ${current.customerName} diubah ke ${newStatus}.`);
  };

  const promptDeleteReceipt = (receipt: AyamAnugrahReceipt) => {
    setReceiptToDelete(receipt);
  };

  const handleConfirmDeleteSingle = async () => {
    if (!receiptToDelete) return;
    const name = receiptToDelete.customerName;
    const code = receiptToDelete.customerCode || '';
    await deleteReceipt(receiptToDelete.id);
    setSelectedReceiptIds((prev) => prev.filter((id) => id !== receiptToDelete.id));
    setReceiptToDelete(null);
    showToast(`Struk "${name} (${code})" berhasil dihapus.`);
  };

  // Bulk Delete Execution
  const handleConfirmBulkDelete = async () => {
    if (!bulkDeleteConfig) return;

    if (bulkDeleteConfig.type === 'selected') {
      const count = selectedReceiptIds.length;
      await deleteReceiptsBatch(selectedReceiptIds);
      setSelectedReceiptIds([]);
      setIsSelectMode(false);
      showToast(`${count} struk terpilih berhasil dihapus.`);
    } else if (bulkDeleteConfig.type === 'belum_lunas') {
      const count = await clearReceipts('belum_lunas');
      showToast(`${count} struk tagihan belum lunas berhasil dihapus.`);
    } else if (bulkDeleteConfig.type === 'lunas') {
      const count = await clearReceipts('lunas');
      showToast(`${count} struk yang lunas berhasil dihapus.`);
    } else if (bulkDeleteConfig.type === 'all') {
      await clearReceipts('all');
      setSelectedReceiptIds([]);
      showToast('Seluruh struk gudang berhasil dikosongkan.');
    }

    setBulkDeleteConfig(null);
  };

  const handleRestoreSampleReceipts = async () => {
    await restoreSampleReceipts();
    showToast('Struk contoh bawaan gudang berhasil dipulihkan.');
    setIsDeleteMenuOpen(false);
  };

  const handleImportSuccess = async (
    importedReceipts: AyamAnugrahReceipt[],
    mode: 'replace' | 'append',
    syncToFinance: boolean
  ) => {
    try {
      const count = await importReceipts(importedReceipts, mode, syncToFinance);
      showToast(`Berhasil mengimpor ${count || importedReceipts.length} struk dari file Excel!`);
    } catch (err: any) {
      console.error('Import error in gallery:', err);
      showToast('Gagal memproses impor struk. Silakan coba kembali.');
      throw err;
    }
  };

  const handleToggleSelectReceipt = (id: string) => {
    setSelectedReceiptIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    if (selectedReceiptIds.length === filteredReceipts.length) {
      setSelectedReceiptIds([]);
    } else {
      setSelectedReceiptIds(filteredReceipts.map((r) => r.id));
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.download-menu-container') && !target.closest('.delete-menu-container')) {
        setActiveDownloadMenuId(null);
        setIsBatchDownloadMenuOpen(false);
        setIsDeleteMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Download Handlers
  const handleDownloadPng = async (receipt: AyamAnugrahReceipt) => {
    setIsDownloading({ id: receipt.id, format: 'PNG' });
    try {
      await downloadReceiptAsPng(receipt);
    } catch (err) {
      console.error(err);
      alert('Gagal mengunduh gambar struk. Silakan coba lagi.');
    } finally {
      setIsDownloading(null);
      setActiveDownloadMenuId(null);
    }
  };

  const handleDownloadTxt = (receipt: AyamAnugrahReceipt) => {
    downloadReceiptAsTxt(receipt);
    setActiveDownloadMenuId(null);
  };

  const handleDownloadCsv = (receipt: AyamAnugrahReceipt) => {
    downloadReceiptAsCsv(receipt);
    setActiveDownloadMenuId(null);
  };

  const handleCopyReceiptText = (receipt: AyamAnugrahReceipt) => {
    const text = formatReceiptAsText(receipt);
    navigator.clipboard.writeText(text);
    setCopiedReceiptId(receipt.id);
    setTimeout(() => {
      setCopiedReceiptId(null);
      setActiveDownloadMenuId(null);
    }, 1500);
  };

  // ROBUST PRINTING: Generates exact thermal receipt document and prints via hidden iframe
  const renderThermalReceiptHtml = (receipt: AyamAnugrahReceipt) => {
    const isLunas = receipt.status === 'LUNAS';
    const customerDisplay = `${receipt.customerName} ${receipt.customerCode ? receipt.customerCode.replace('#', '') : ''}`.trim();
    const dateStr = receipt.date || '2026-11-02';
    const timeStr = receipt.time || '00:57:55';
    const handleStr = receipt.storeHandle || '@@ anugrah';

    return `
      <div class="receipt-body">
        <div class="center" style="margin-bottom: 6px;">
          <img src="/assets/rooster-mascot.png" alt="Mascot" style="width: 62px; height: auto; margin: 0 auto; display: block;" />
        </div>
        <div class="center bold brand-title">${receipt.storeHeaderName || 'aa anugrah'}</div>
        <div class="center brand-sub">Menyediakan Daging Ayam FRESH &amp; TERJANGKAU</div>
        <div class="center brand-sub">Untuk Kebutuhan Anda</div>
        <div class="center brand-phone">&#128222; ${receipt.storePhone || '085735144958'}</div>

        <div class="dashed"></div>

        <div class="flex-between meta-text">
          <div>
            <div>${dateStr}</div>
            <div>${timeStr}</div>
          </div>
          <div style="text-align: right;">
            <div>${handleStr}</div>
            <div>${handleStr}</div>
          </div>
        </div>

        <div class="dashed"></div>

        <div class="bold" style="font-size: 13px; margin: 3px 0 5px 0;">
          ${customerDisplay}
        </div>
        ${receipt.noteBox ? `<div class="note-box">${receipt.noteBox}</div>` : ''}

        <div class="items-wrap">
          ${receipt.items
            .map((item) => {
              const isChicken = (item.name || '').toLowerCase().includes('ayam');
              return `
              <div class="line-item">
                ${!isChicken ? `<div class="bold item-title">${item.name}</div>` : ''}
                <div class="flex-between">
                  <span>${item.quantity} x ${formatAngkaIndo(item.price)}</span>
                  <span>Rp ${formatAngkaIndo(item.total)}</span>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>

        <div class="dashed"></div>

        <div class="flex-between" style="font-size: 13px; margin: 4px 0;">
          <span>Total</span>
          <span class="bold">Rp ${formatAngkaIndo(receipt.totalAmount)}</span>
        </div>

        <div class="dashed"></div>

        <div class="flex-between meta-text">
          <span>Tipe: ${receipt.paymentType || 'kredit'}</span>
          <span>due: ${receipt.dueDate || '09/11/2026'}</span>
        </div>
        <div class="meta-text">
          Status: ${isLunas ? 'Lunas' : 'Belum Lunas'}
        </div>
        <div class="meta-text">
          Sisa utang: Rp ${formatAngkaIndo(isLunas ? 0 : (receipt.remainingDebt ?? receipt.totalAmount))}
        </div>

        <div class="dashed"></div>

        <div class="meta-text">History Pembayaran Utang:</div>
        <div class="flex-between meta-text" style="margin-top: 2px;">
          <span>${receipt.historyDate || '02/11/2026'}</span>
          <span>Rp ${formatAngkaIndo(isLunas ? receipt.totalAmount : (receipt.paidAmount ?? 0))}</span>
        </div>

        <div class="center" style="margin-top: 14px;">
          <img src="/assets/kasir-pintar-footer.png" alt="Kasir Pintar" style="width: 175px; height: auto; margin: 0 auto; display: block;" />
        </div>
      </div>
    `;
  };

  const printSingleReceipt = (receipt: AyamAnugrahReceipt) => {
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Struk_${receipt.customerName}_${receipt.customerCode || ''}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 10px 4px;
              color: #000;
              background: #fff;
              font-size: 11px;
              line-height: 1.35;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .dashed { border-bottom: 1px dashed #000; margin: 6px 0; }
            .brand-title { font-family: system-ui, -apple-system, sans-serif; font-size: 17px; margin-bottom: 2px; }
            .brand-sub { font-family: system-ui, -apple-system, sans-serif; font-size: 9.5px; color: #222; }
            .brand-phone { font-family: system-ui, -apple-system, sans-serif; font-size: 10.5px; font-weight: bold; margin-top: 2px; }
            .meta-text { font-size: 10.5px; }
            .line-item { margin: 4px 0; font-size: 11.5px; }
            .item-title { font-size: 11.5px; margin-bottom: 1px; }
            .flex-between { display: flex; justify-content: space-between; }
            .note-box {
              display: inline-block;
              border: 1px solid #000;
              padding: 2px 6px;
              margin: 3px 0;
              font-weight: bold;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          ${renderThermalReceiptHtml(receipt)}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `;

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
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(receiptHtml);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            window.print();
          }
        }, 300);
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  };

  // Batch Print All Visible Receipts
  const printAllReceipts = () => {
    const combinedReceiptsHtml = filteredReceipts
      .map(
        (receipt) => `
        <div style="page-break-after: always; padding: 12px 4px; width: 72mm; margin: 0 auto;">
          ${renderThermalReceiptHtml(receipt)}
        </div>
      `
      )
      .join('');

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Batch_Struk_Ayam_Anugerah</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              color: #000;
              background: #fff;
              font-size: 11px;
              line-height: 1.35;
              margin: 0;
              padding: 0;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .dashed { border-bottom: 1px dashed #000; margin: 6px 0; }
            .line-item { margin: 6px 0; }
            .flex-between { display: flex; justify-content: space-between; }
            .note-box {
              display: inline-block;
              border: 1px solid #000;
              padding: 2px 6px;
              margin: 4px 0;
              font-weight: bold;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          ${combinedReceiptsHtml}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    let iframe = document.getElementById('receipt-print-frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(fullHtml);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 350);
    }
  };

  // WhatsApp share
  const shareReceiptWA = (receipt: AyamAnugrahReceipt) => {
    const lines = receipt.items
      .map(
        (it) => `*${it.name} ${it.detailLabel || ''}*\n  ${it.quantity} ${it.unit} x ${formatAngkaIndo(it.price)} = Rp ${formatAngkaIndo(it.total)}`
      )
      .join('\n');

    const text = `
*AYAM @ ANUGRAH*
DATA HARIAN GUDANG
STRUK TAGIHAN / INVOICE
------------------------------------
Tanggal   : ${receipt.date}
Pelanggan : *${receipt.customerName} (${receipt.customerCode || '#--'})*
${receipt.noteBox ? `[ ${receipt.noteBox} ]\n` : ''}------------------------------------
${lines}
------------------------------------
*TOTAL TAGIHAN : Rp ${formatAngkaIndo(receipt.totalAmount)}*
Status Pembayaran : *[ ${receipt.status} ]*
------------------------------------
Mohon segera melakukan pembayaran.
Terima Kasih Atas Kerjasamanya.
`.trim();

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Add / Edit handlers
  const handleOpenAdd = () => {
    setEditingReceipt(null);
    setFormDate('01 Nov 2026');
    setFormCustomerName('');
    setFormCustomerCode(`#${String(receipts.length + 1).padStart(2, '0')}`);
    setFormNoteBox('');
    setFormStatus('BELUM LUNAS');
    setFormItems([
      { name: 'Ayam Gebrus', detailLabel: '(30 ekor)', quantity: 50.0, unit: 'kg', price: 25500, total: 1275000 },
      { name: 'Ati', quantity: 30, unit: 'bj', price: 1500, total: 45000 },
      { name: 'Usus', quantity: 5, unit: 'kg', price: 15000, total: 75000 },
    ]);
    setIsNewModalOpen(true);
  };

  const handleOpenEdit = (r: AyamAnugrahReceipt) => {
    setEditingReceipt(r);
    setFormDate(r.date);
    setFormCustomerName(r.customerName);
    setFormCustomerCode(r.customerCode || '');
    setFormNoteBox(r.noteBox || '');
    setFormStatus(r.status);
    setFormItems(r.items);
    setIsNewModalOpen(true);
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      showToast('Nama pelanggan wajib diisi.');
      return;
    }

    const total = formItems.reduce((sum, item) => sum + item.total, 0);

    if (editingReceipt) {
      await updateReceipt(editingReceipt.id, {
        date: formDate,
        customerName: formCustomerName.trim(),
        customerCode: formCustomerCode.trim(),
        noteBox: formNoteBox.trim() || '',
        items: formItems,
        totalAmount: total,
        status: formStatus,
      });
      showToast(`Struk "${formCustomerName}" berhasil diperbarui.`);
    } else {
      const newReceipt: AyamAnugrahReceipt = {
        id: 'rcp_' + Date.now(),
        userId: 'guest',
        receiptNumber: `INV-AA-${receipts.length + 1}`,
        date: formDate,
        customerName: formCustomerName.trim(),
        customerCode: formCustomerCode.trim() || `#${String(receipts.length + 1).padStart(2, '0')}`,
        noteBox: formNoteBox.trim() || '',
        items: formItems,
        totalAmount: total,
        status: formStatus,
        createdAt: new Date().toISOString(),
      };
      await addReceipt(newReceipt);
      showToast(`Struk baru "${formCustomerName}" berhasil dibuat.`);
    }

    setIsNewModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Gudang Summary */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-amber-100 text-amber-900 font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg lg:text-xl font-extrabold text-gray-900">
                AYAM @ ANUGRAH — DATA HARIAN GUDANG
              </h2>
              <p className="text-xs text-gray-500">
                Struk Tagihan Fisik Resmi, Cetak Thermal POS & Kontrol Status Pembayaran
              </p>
            </div>
          </div>
        </div>

        {/* Actions & Clear Rekap Trigger */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Menu Hapus Struk Dropdown */}
          <div className="relative delete-menu-container">
            <button
              onClick={() => setIsDeleteMenuOpen(!isDeleteMenuOpen)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all shadow-2xs"
              title="Menu Hapus Struk & Kelola Pembersihan"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Menu Hapus Struk</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDeleteMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDeleteMenuOpen && (
              <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-gray-200/90 p-2 z-40 text-xs">
                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100 mb-1 flex items-center justify-between">
                  <span>Pilihan Menu Hapus</span>
                  <span className="text-rose-600 font-bold">{receipts.length} Struk</span>
                </div>

                {/* 1. Mode Pilih Struk Checklist */}
                <button
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    setIsDeleteMenuOpen(false);
                    if (!isSelectMode) setSelectedReceiptIds([]);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl transition-colors ${
                    isSelectMode ? 'bg-amber-50 text-amber-900 font-bold' : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold">{isSelectMode ? 'Matikan Mode Pilihan Checklist' : 'Pilih & Hapus Banyak Struk (Checklist)'}</div>
                    <div className="text-[10px] text-gray-500">Tandai kotak centang struk mana saja yang ingin dihapus</div>
                  </div>
                </button>

                {/* 2. Hapus Semua Belum Lunas */}
                <button
                  onClick={() => {
                    const count = receipts.filter((r) => r.status === 'BELUM LUNAS').length;
                    if (count === 0) {
                      showToast('Tidak ada struk belum lunas.');
                      setIsDeleteMenuOpen(false);
                      return;
                    }
                    setBulkDeleteConfig({
                      type: 'belum_lunas',
                      title: 'Hapus Semua Struk Belum Lunas?',
                      description: `Ada ${count} struk berstatus BELUM LUNAS bernilai ${formatRupiah(totalOutstanding)} yang akan dihapus permanen.`,
                      count,
                    });
                    setIsDeleteMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-rose-50 text-gray-700 hover:text-rose-800 transition-colors"
                >
                  <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold">Hapus Semua Struk Belum Lunas</div>
                    <div className="text-[10px] text-gray-500">Hapus {receipts.filter((r) => r.status === 'BELUM LUNAS').length} struk tagihan tertunda</div>
                  </div>
                </button>

                {/* 3. Hapus Semua Lunas */}
                <button
                  onClick={() => {
                    const count = receipts.filter((r) => r.status === 'LUNAS').length;
                    if (count === 0) {
                      showToast('Tidak ada struk lunas untuk dihapus.');
                      setIsDeleteMenuOpen(false);
                      return;
                    }
                    setBulkDeleteConfig({
                      type: 'lunas',
                      title: 'Hapus Semua Struk yang Sudah Lunas?',
                      description: `Ada ${count} struk berstatus LUNAS bernilai ${formatRupiah(totalPaid)} yang akan dibersihkan dari daftar aktif.`,
                      count,
                    });
                    setIsDeleteMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 transition-colors"
                >
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold">Hapus Semua Struk Lunas</div>
                    <div className="text-[10px] text-gray-500">Arsipkan struk yang telah lunas ({receipts.filter((r) => r.status === 'LUNAS').length})</div>
                  </div>
                </button>

                {/* 4. Kosongkan Seluruh Struk Gudang */}
                <button
                  onClick={() => {
                    setBulkDeleteConfig({
                      type: 'all',
                      title: 'Kosongkan Seluruh Struk Gudang?',
                      description: `Apakah Anda yakin ingin menghapus SEMUA (${receipts.length}) struk tagihan gudang? Anda tetap bisa memulihkan struk contoh kapan saja.`,
                      count: receipts.length,
                    });
                    setIsDeleteMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-rose-100 text-rose-900 transition-colors"
                >
                  <div className="p-1.5 bg-rose-200 text-rose-800 rounded-lg shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-rose-950">Kosongkan Seluruh Struk ({receipts.length})</div>
                    <div className="text-[10px] text-rose-700">Hapus semua struk dari memori penyimpanan</div>
                  </div>
                </button>

                <div className="border-t border-gray-100 my-1"></div>

                {/* 5. Pulihkan Struk Contoh */}
                <button
                  onClick={handleRestoreSampleReceipts}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-blue-50 text-blue-800 transition-colors"
                >
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold">Pulihkan Struk Contoh Bawaan</div>
                    <div className="text-[10px] text-blue-600">Muat ulang data contoh Moris #09 dll.</div>
                  </div>
                </button>

                {/* 6. Hapus Rekap Keuangan & Arus Kas */}
                <button
                  onClick={() => {
                    setIsDeleteMenuOpen(false);
                    onOpenClearModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
                >
                  <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold">Hapus Rekap Arus Kas Keuangan</div>
                    <div className="text-[10px] text-gray-400">Buka panel pembersihan transaksi bulanan</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Ekspor Excel Gudang Sesuai Google Sheets */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
            title="Ekspor ke Excel persis format Google Sheets (DATA HARIAN GUDANG - AYAM @ ANUGRAH)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
            <span>Ekspor Excel Gudang</span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-emerald-600 rounded font-semibold text-emerald-100">
              Google Sheets
            </span>
          </button>

          {/* Impor Excel Gudang */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
            title="Import data Excel atau CSV ke daftar struk gudang"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Impor Excel</span>
          </button>

          <button
            onClick={printAllReceipts}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
            title="Cetak seluruh struk sekaligus untuk pengiriman gudang"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Semua ({filteredReceipts.length})</span>
          </button>

          {/* Batch Download Menu */}
          <div className="relative download-menu-container">
            <button
              onClick={() => setIsBatchDownloadMenuOpen(!isBatchDownloadMenuOpen)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-all shadow-2xs"
              title="Download semua data struk sekaligus"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Download Semua</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isBatchDownloadMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isBatchDownloadMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-76 bg-white rounded-2xl shadow-xl border border-gray-100 p-2.5 z-40 text-xs">
                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100 mb-1">
                  Format Download Semua ({filteredReceipts.length} Struk)
                </div>

                {/* 1. Format Excel Gudang .XLSX Google Sheets */}
                <button
                  onClick={() => {
                    exportToExcelGoogleSheetFormat(filteredReceipts);
                    setIsBatchDownloadMenuOpen(false);
                    showToast('File Excel format gudang (.xlsx) berhasil diunduh.');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-emerald-50 text-emerald-900 transition-colors"
                >
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                      <span>Excel Gudang (.XLSX)</span>
                      <span className="px-1 text-[8px] bg-emerald-100 text-emerald-800 rounded font-bold border border-emerald-300">Google Sheets</span>
                    </div>
                    <div className="text-[10px] text-emerald-700">Multi-header, formula perkalian & baris JUMLAH</div>
                  </div>
                </button>

                {/* 2. Format Gudang .CSV Google Sheets */}
                <button
                  onClick={() => {
                    exportToCsvGoogleSheetFormat(filteredReceipts);
                    setIsBatchDownloadMenuOpen(false);
                    showToast('File CSV format gudang berhasil diunduh.');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-blue-50 text-blue-900 transition-colors"
                >
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">Format Gudang (.CSV)</div>
                    <div className="text-[10px] text-gray-500">Impor langsung ke Google Sheets / Microsoft Excel</div>
                  </div>
                </button>

                {/* 3. Pratinjau Tabel Gudang */}
                <button
                  onClick={() => {
                    setIsBatchDownloadMenuOpen(false);
                    setIsExportModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-purple-50 text-purple-900 transition-colors"
                >
                  <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg shrink-0">
                    <Table className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">Pratinjau Tabel & Salin Data</div>
                    <div className="text-[10px] text-gray-500">Lihat grid tabel lengkap & salin ke clipboard</div>
                  </div>
                </button>

                <div className="border-t border-gray-100 my-1"></div>

                {/* 4. Rekap CSV Detail Item */}
                <button
                  onClick={() => {
                    downloadAllReceiptsAsCsv(filteredReceipts);
                    setIsBatchDownloadMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
                >
                  <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">Rekap Detail Item (.CSV)</div>
                    <div className="text-[10px] text-gray-500">Baris per item satuan produk ayam</div>
                  </div>
                </button>

                {/* 5. Gabungan Nota TXT */}
                <button
                  onClick={() => {
                    downloadAllReceiptsAsTxt(filteredReceipts);
                    setIsBatchDownloadMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-amber-50 text-gray-700 hover:text-amber-800 transition-colors"
                >
                  <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">Gabungan Nota (.TXT)</div>
                    <div className="text-[10px] text-gray-500">Format teks thermal lengkap berurutan</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Buat Struk Baru</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <div className="text-gray-400 text-[11px] font-bold uppercase">Total Tagihan Beredar</div>
          <div className="text-lg font-black font-mono text-gray-900 mt-0.5">
            {formatRupiah(totalOutstanding + totalPaid)}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">{receipts.length} struk tercatat di gudang</div>
        </div>

        <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200 shadow-xs">
          <div className="text-rose-700 text-[11px] font-bold uppercase">Belum Lunas (Piutang)</div>
          <div className="text-lg font-black font-mono text-rose-700 mt-0.5">
            {formatRupiah(totalOutstanding)}
          </div>
          <div className="text-[10px] text-rose-600 mt-1">
            {receipts.filter((r) => r.status === 'BELUM LUNAS').length} pelanggan belum membayar
          </div>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="text-emerald-800 text-[11px] font-bold uppercase">Lunas (Kas Masuk)</div>
          <div className="text-lg font-black font-mono text-emerald-700 mt-0.5">
            {formatRupiah(totalPaid)}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">
            {receipts.filter((r) => r.status === 'LUNAS').length} pelanggan telah lunas
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari pelanggan (#09, Moris, Pak Ade)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['ALL', 'BELUM LUNAS', 'LUNAS'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                statusFilter === st
                  ? st === 'BELUM LUNAS'
                    ? 'bg-rose-600 text-white'
                    : st === 'LUNAS'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {st === 'ALL' ? 'Semua Struk' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-Select Toolbar Banner */}
      {isSelectMode && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-200 text-amber-900 rounded-xl font-bold">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-amber-950">
                Mode Pilihan Hapus Struk
              </div>
              <div className="text-xs text-amber-800">
                <strong>{selectedReceiptIds.length}</strong> dari {filteredReceipts.length} struk dipilih
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSelectAllVisible}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 text-xs font-bold rounded-xl hover:bg-amber-100 transition-colors"
            >
              {selectedReceiptIds.length === filteredReceipts.length ? 'Batal Pilih Semua' : `Pilih Semua (${filteredReceipts.length})`}
            </button>
            <button
              onClick={() => {
                setIsSelectMode(false);
                setSelectedReceiptIds([]);
              }}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Keluar
            </button>
            <button
              disabled={selectedReceiptIds.length === 0}
              onClick={() => {
                setBulkDeleteConfig({
                  type: 'selected',
                  title: `Hapus ${selectedReceiptIds.length} Struk Terpilih?`,
                  description: `Apakah Anda yakin ingin menghapus ${selectedReceiptIds.length} struk yang telah dicentang secara permanen?`,
                  count: selectedReceiptIds.length,
                });
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus ({selectedReceiptIds.length}) Struk</span>
            </button>
          </div>
        </div>
      )}

      {/* Vertical Feed of Receipts Matching Screenshots */}
      <div className="space-y-6 max-w-xl mx-auto">
        {filteredReceipts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-3">
            <div className="p-3 bg-amber-50 text-amber-700 w-12 h-12 rounded-2xl mx-auto flex items-center justify-center">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Tidak ada struk yang ditemukan</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {receipts.length === 0
                ? 'Seluruh struk telah dibersihkan. Anda dapat memulihkan struk contoh bawaan atau membuat struk baru.'
                : 'Tidak ada struk yang cocok dengan kata kunci pencarian atau filter status ini.'}
            </p>
            {receipts.length === 0 && (
              <button
                onClick={handleRestoreSampleReceipts}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Pulihkan Struk Contoh Resmi</span>
              </button>
            )}
          </div>
        ) : null}

        {filteredReceipts.map((receipt) => {
          const isLunas = receipt.status === 'LUNAS';
          const isSelected = selectedReceiptIds.includes(receipt.id);

          return (
            <div
              key={receipt.id}
              className={`bg-white rounded-2xl p-6 shadow-md border font-mono text-xs relative group transition-all hover:shadow-lg ${
                isSelected ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50/15' : 'border-gray-200/90'
              }`}
            >
              {/* Checkbox Header when Selection Mode is Active */}
              {isSelectMode && (
                <div
                  onClick={() => handleToggleSelectReceipt(receipt.id)}
                  className={`mb-3 p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-100 border-blue-300 text-blue-900' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <span className="text-xs font-sans font-bold">
                      {isSelected ? 'Struk Terpilih (Akan Dihapus)' : 'Klik untuk Pilih Struk'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold">{receipt.customerCode || ''}</span>
                </div>
              )}

              {/* Receipt Paper Container with Sawtooth Jagged Tear Edges */}
              <div className="bg-neutral-900/90 rounded-2xl p-2 sm:p-3 shadow-xl">
                {/* Top Sawtooth / Zigzag Jagged Tear */}
                <div className="w-full h-3 overflow-hidden text-white -mb-0.5 select-none pointer-events-none">
                  <svg className="w-full h-3 fill-current" preserveAspectRatio="none" viewBox="0 0 100 10">
                    <polygon points="0,10 2.5,0 5,10 7.5,0 10,10 12.5,0 15,10 17.5,0 20,10 22.5,0 25,10 27.5,0 30,10 32.5,0 35,10 37.5,0 40,10 42.5,0 45,10 47.5,0 50,10 52.5,0 55,10 57.5,0 60,10 62.5,0 65,10 67.5,0 70,10 72.5,0 75,10 77.5,0 80,10 82.5,0 85,10 87.5,0 90,10 92.5,0 95,10 97.5,0 100,10" />
                  </svg>
                </div>

                {/* White Thermal Receipt Paper Body */}
                <div className="bg-white px-5 sm:px-7 py-5 font-mono text-gray-900 shadow-inner">
                  {/* Rooster Mascot */}
                  <div className="flex justify-center mb-1">
                    <img
                      src="/assets/rooster-mascot.png"
                      alt="Logo Ayam Anugrah"
                      className="w-18 h-18 sm:w-20 sm:h-20 object-contain drop-shadow-xs"
                      loading="lazy"
                    />
                  </div>

                  {/* Store Brand Header */}
                  <div className="text-center space-y-0.5 font-sans">
                    <div className="font-black text-xl sm:text-2xl tracking-tight text-gray-950">
                      {receipt.storeHeaderName || 'aa anugrah'}
                    </div>
                    <div className="text-[11px] sm:text-xs text-gray-800 leading-tight">
                      Menyediakan Daging Ayam FRESH &amp; TERJANGKAU
                    </div>
                    <div className="text-[11px] sm:text-xs text-gray-800 leading-tight">
                      Untuk Kebutuhan Anda
                    </div>
                    <div className="text-xs font-bold text-gray-950 pt-0.5">
                      📞 {receipt.storePhone || '085735144958'}
                    </div>
                  </div>

                  {/* Dashed Separator */}
                  <div className="border-b border-dashed border-gray-400 my-2.5"></div>

                  {/* 2-Column Metadata (Date/Time & Social Handles) */}
                  <div className="flex justify-between items-start text-xs text-gray-900 leading-snug">
                    <div>
                      <div>{receipt.date || '2026-11-02'}</div>
                      <div>{receipt.time || '00:57:55'}</div>
                    </div>
                    <div className="text-right">
                      <div>{receipt.storeHandle || '@@ anugrah'}</div>
                      <div>{receipt.storeHandle || '@@ anugrah'}</div>
                    </div>
                  </div>

                  {/* Dashed Separator */}
                  <div className="border-b border-dashed border-gray-400 my-2.5"></div>

                  {/* Customer Line */}
                  <div className="font-bold text-sm text-gray-950">
                    {receipt.customerName}{' '}
                    {receipt.customerCode ? receipt.customerCode.replace('#', '') : ''}
                  </div>

                  {receipt.noteBox && (
                    <div className="my-1.5">
                      <span className="inline-block border border-gray-900 px-2 py-0.5 text-[10px] font-sans font-bold bg-white text-gray-900">
                        {receipt.noteBox}
                      </span>
                    </div>
                  )}

                  {/* Line Items */}
                  <div className="space-y-2.5 py-1">
                    {receipt.items.map((item, idx) => {
                      const isChicken = (item.name || '').toLowerCase().includes('ayam');
                      return (
                        <div key={idx} className="space-y-0.5">
                          {!isChicken && (
                            <div className="font-bold text-gray-950 text-xs">
                              {item.name}
                            </div>
                          )}
                          <div className="flex justify-between items-baseline text-xs text-gray-900">
                            <span>
                              {item.quantity} x {formatAngkaIndo(item.price)}
                            </span>
                            <span className="font-semibold text-gray-950">
                              Rp {formatAngkaIndo(item.total)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dashed Separator */}
                  <div className="border-b border-dashed border-gray-400 my-2.5"></div>

                  {/* Total */}
                  <div className="flex justify-between items-center text-sm font-bold text-gray-950">
                    <span className="font-medium">Total</span>
                    <span className="text-base font-extrabold">
                      Rp {formatAngkaIndo(receipt.totalAmount)}
                    </span>
                  </div>

                  {/* Dashed Separator */}
                  <div className="border-b border-dashed border-gray-400 my-2.5"></div>

                  {/* Credit / Due Section */}
                  <div className="space-y-1 text-xs text-gray-900">
                    <div className="flex justify-between items-center">
                      <span>Tipe: {receipt.paymentType || 'kredit'}</span>
                      <span>due: {receipt.dueDate || '09/11/2026'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Status: {isLunas ? 'Lunas' : 'Belum Lunas'}</span>
                      <button
                        onClick={() => handleToggleStatus(receipt.id)}
                        title="Klik untuk ubah status lunas / belum lunas"
                        className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase transition-all ${
                          isLunas
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-400 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-900 border border-rose-400 hover:bg-rose-200'
                        }`}
                      >
                        [ {receipt.status} ]
                      </button>
                    </div>
                    <div>
                      Sisa utang: Rp{' '}
                      {formatAngkaIndo(isLunas ? 0 : (receipt.remainingDebt ?? receipt.totalAmount))}
                    </div>
                  </div>

                  {/* Dashed Separator */}
                  <div className="border-b border-dashed border-gray-400 my-2.5"></div>

                  {/* History Pembayaran Utang Section */}
                  <div className="space-y-1 text-xs text-gray-900">
                    <div>History Pembayaran Utang:</div>
                    <div className="flex justify-between items-center">
                      <span>{receipt.historyDate || '02/11/2026'}</span>
                      <span className="font-semibold">
                        Rp{' '}
                        {formatAngkaIndo(isLunas ? receipt.totalAmount : (receipt.paidAmount ?? 0))}
                      </span>
                    </div>
                  </div>

                  {/* Kasir Pintar / Play Store Footer */}
                  <div className="mt-5 pt-1 text-center">
                    <img
                      src="/assets/kasir-pintar-footer.png"
                      alt="Kasir Pintar & Google Play"
                      className="w-52 sm:w-56 h-auto mx-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>

                {/* Bottom Sawtooth / Zigzag Jagged Tear */}
                <div className="w-full h-3 overflow-hidden text-white -mt-0.5 select-none pointer-events-none">
                  <svg className="w-full h-3 fill-current rotate-180" preserveAspectRatio="none" viewBox="0 0 100 10">
                    <polygon points="0,10 2.5,0 5,10 7.5,0 10,10 12.5,0 15,10 17.5,0 20,10 22.5,0 25,10 27.5,0 30,10 32.5,0 35,10 37.5,0 40,10 42.5,0 45,10 47.5,0 50,10 52.5,0 55,10 57.5,0 60,10 62.5,0 65,10 67.5,0 70,10 72.5,0 75,10 77.5,0 80,10 82.5,0 85,10 87.5,0 90,10 92.5,0 95,10 97.5,0 100,10" />
                  </svg>
                </div>
              </div>

              {/* Action Toolbar on Bottom of each card */}
              <div className="mt-5 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 font-sans">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => shareReceiptWA(receipt)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Kirim WA</span>
                  </button>

                  {/* Menu Download Dropdown for this Receipt */}
                  <div className="relative download-menu-container">
                    <button
                      onClick={() =>
                        setActiveDownloadMenuId(activeDownloadMenuId === receipt.id ? null : receipt.id)
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 rounded-xl text-xs font-bold transition-all"
                      title="Buka menu unduh struk dalam berbagai format"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>Download</span>
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${
                          activeDownloadMenuId === receipt.id ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {activeDownloadMenuId === receipt.id && (
                      <div className="absolute left-0 bottom-full mb-2 w-76 bg-white rounded-2xl shadow-2xl border border-gray-200/90 p-2.5 z-50 text-xs">
                        <div className="px-3 py-1.5 border-b border-gray-100 mb-1 flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                            Menu Download Struk
                          </span>
                          <span className="text-[10px] font-mono font-bold text-gray-700">
                            {receipt.customerCode || ''}
                          </span>
                        </div>

                        {/* 1. Download Gambar PNG */}
                        <button
                          onClick={() => handleDownloadPng(receipt)}
                          disabled={isDownloading?.id === receipt.id}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-blue-50 text-gray-700 hover:text-blue-900 transition-colors"
                        >
                          <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 flex items-center gap-1.5">
                              <span>Download Gambar (.PNG)</span>
                              {isDownloading?.id === receipt.id && isDownloading?.format === 'PNG' && (
                                <span className="text-[10px] font-normal text-blue-600 animate-pulse">Membuat...</span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate">
                              Gambar struk jernih untuk WhatsApp / galeri
                            </div>
                          </div>
                        </button>

                        {/* 2. Download Dokumen PDF */}
                        <button
                          onClick={() => {
                            printSingleReceipt(receipt);
                            setActiveDownloadMenuId(null);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-amber-50 text-gray-700 hover:text-amber-900 transition-colors"
                        >
                          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900">Download Dokumen PDF</div>
                            <div className="text-[10px] text-gray-500 truncate">
                              Ukuran 80mm standar struk kasir thermal
                            </div>
                          </div>
                        </button>

                        {/* 3. Download Nota Teks TXT */}
                        <button
                          onClick={() => handleDownloadTxt(receipt)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-purple-50 text-gray-700 hover:text-purple-900 transition-colors"
                        >
                          <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900">Download Nota Teks (.TXT)</div>
                            <div className="text-[10px] text-gray-500 truncate">
                              Format teks untuk printer bluetooth & arsip
                            </div>
                          </div>
                        </button>

                        {/* 4. Download Excel CSV */}
                        <button
                          onClick={() => handleDownloadCsv(receipt)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-emerald-50 text-gray-700 hover:text-emerald-900 transition-colors"
                        >
                          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900">Download Data Excel (.CSV)</div>
                            <div className="text-[10px] text-gray-500 truncate">
                              Tabel rincian barang, kg, harga & total
                            </div>
                          </div>
                        </button>

                        <div className="border-t border-gray-100 my-1"></div>

                        {/* 5. Salin Teks Struk */}
                        <button
                          onClick={() => handleCopyReceiptText(receipt)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
                        >
                          <div className="p-1.5 rounded-lg bg-gray-100 text-gray-600 shrink-0">
                            {copiedReceiptId === receipt.id ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900">
                              {copiedReceiptId === receipt.id ? 'Berhasil Disalin!' : 'Salin Teks Nota'}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate">
                              Salin ke papan klip untuk SMS / Chat
                            </div>
                          </div>
                        </button>

                        <div className="border-t border-gray-100 my-1"></div>

                        {/* 6. Hapus Struk dari Menu */}
                        <button
                          onClick={() => {
                            setActiveDownloadMenuId(null);
                            promptDeleteReceipt(receipt);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-rose-50 text-rose-700 transition-colors"
                        >
                          <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold">Hapus Struk Ini</div>
                            <div className="text-[10px] text-rose-500 truncate">Hapus dari arsip struk gudang</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenEdit(receipt)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit Struk"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => promptDeleteReceipt(receipt)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/60 rounded-xl transition-colors text-xs font-bold"
                    title="Hapus Struk Ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>

                <button
                  onClick={() => printSingleReceipt(receipt)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Struk Ini</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-amber-50/50">
              <h3 className="font-bold text-gray-900 text-base">
                {editingReceipt ? 'Edit Struk Tagihan Gudang' : 'Buat Struk Gudang Baru'}
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReceipt} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Tanggal Struk</label>
                  <input
                    type="text"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    placeholder="01 Nov 2026"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Kode / No. Urut</label>
                  <input
                    type="text"
                    value={formCustomerCode}
                    onChange={(e) => setFormCustomerCode(e.target.value)}
                    placeholder="#09"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Nama Pelanggan</label>
                  <input
                    type="text"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    placeholder="Contoh: Moris, Nanjung, Pak Ade"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Kotak Ket (Pita/Warna)</label>
                  <input
                    type="text"
                    value={formNoteBox}
                    onChange={(e) => setFormNoteBox(e.target.value)}
                    placeholder="Ket: Pita Putih"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Status Pembayaran</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus('BELUM LUNAS')}
                    className={`py-2 text-xs font-bold rounded-xl border ${
                      formStatus === 'BELUM LUNAS'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    [ BELUM LUNAS ]
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('LUNAS')}
                    className={`py-2 text-xs font-bold rounded-xl border ${
                      formStatus === 'LUNAS'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    [ LUNAS ]
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center text-xs font-bold text-gray-800">
                  <span>Rincian Barang Tagihan</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormItems((prev) => [
                        ...prev,
                        { name: 'Item Tambahan', quantity: 1, unit: 'kg', price: 10000, total: 10000 },
                      ])
                    }
                    className="text-amber-700 hover:underline text-[11px]"
                  >
                    + Tambah Item
                  </button>
                </div>

                {formItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-gray-50 rounded-xl space-y-2 border border-gray-200">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, name: val } : it))
                          );
                        }}
                        placeholder="Nama Item (Ayam Gebrus)"
                        className="flex-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        value={item.detailLabel || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, detailLabel: val } : it))
                          );
                        }}
                        placeholder="(30 ekor)"
                        className="w-24 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setFormItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-500">Jumlah/Bobot</span>
                        <input
                          type="number"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) => {
                            const q = parseFloat(e.target.value) || 0;
                            setFormItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, quantity: q, total: Math.round(q * it.price) } : it
                              )
                            );
                          }}
                          className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-gray-500">Satuan (kg/bj)</span>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => {
                            const u = e.target.value;
                            setFormItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, unit: u } : it))
                            );
                          }}
                          className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-gray-500">Harga Satuan</span>
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => {
                            const p = parseFloat(e.target.value) || 0;
                            setFormItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, price: p, total: Math.round(it.quantity * p) } : it
                              )
                            );
                          }}
                          className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Preview */}
              <div className="p-3 bg-gray-100 rounded-xl flex justify-between items-center text-xs font-bold">
                <span>TOTAL AKHIR:</span>
                <span className="text-sm font-extrabold font-mono text-emerald-700">
                  {formatRupiah(formItems.reduce((sum, item) => sum + item.total, 0))}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-xl hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs"
                >
                  Simpan Struk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      {receiptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-base">
                    Hapus Struk Tagihan?
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Struk ini akan dihapus secara permanen dari daftar struk gudang.
                  </p>
                </div>
              </div>

              {/* Receipt Preview */}
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-1.5 text-xs font-mono">
                <div className="flex justify-between items-center text-gray-800">
                  <span className="font-sans text-[11px] text-gray-500">Pelanggan:</span>
                  <span className="font-bold text-gray-900">
                    {receiptToDelete.customerName} ({receiptToDelete.customerCode || '#--'})
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span className="font-sans text-[11px] text-gray-500">Tanggal:</span>
                  <span>{receiptToDelete.date}</span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span className="font-sans text-[11px] text-gray-500">Total Tagihan:</span>
                  <span className="font-bold text-rose-700">Rp {formatAngkaIndo(receiptToDelete.totalAmount)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
                  <span className="font-sans text-[11px] text-gray-500">Status Pembayaran:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      receiptToDelete.status === 'LUNAS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    [ {receiptToDelete.status} ]
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setReceiptToDelete(null)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSingle}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-rose-600/25 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Hapus Struk Ini</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-base">
                    {bulkDeleteConfig.title}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    {bulkDeleteConfig.description}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-[11px] text-rose-800 font-medium leading-relaxed">
                ⚠️ <strong>Catatan:</strong> Data struk yang dihapus tidak dapat dipulihkan secara otomatis kecuali Anda memilih opsi <em>"Pulihkan Struk Contoh"</em> dari menu hapus.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkDeleteConfig(null)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkDelete}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-rose-600/25 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Konfirmasi Hapus ({bulkDeleteConfig.count})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Warehouse Google Sheet Excel & CSV Preview & Export Modal */}
      <WarehouseGoogleSheetModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        receipts={filteredReceipts}
      />

      {/* Warehouse Excel & CSV Import Modal */}
      <WarehouseImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};
