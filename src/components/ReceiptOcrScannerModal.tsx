import React, { useState, useRef, useEffect } from 'react';
import { AyamAnugrahReceipt, AyamReceiptLineItem } from '../types/index';
import { formatAngkaIndo, formatRupiah, getTodayDateString } from '../data/defaults';
import {
  X,
  Upload,
  Camera,
  Sparkles,
  CheckCircle,
  AlertCircle,
  FileText,
  RotateCcw,
  Plus,
  Trash2,
  Receipt,
  Eye,
  ArrowRight,
  ZoomIn,
  Edit2,
  Check,
  Clock,
  Layers,
  ChevronRight,
  Save,
  RefreshCw,
  FolderPlus,
  Zap,
} from 'lucide-react';

export interface ReceiptBatchItem {
  id: string;
  fileName: string;
  fileSize?: string;
  imagePreview: string; // base64
  mimeType: string;
  status: 'pending' | 'scanning' | 'success' | 'error' | 'saved';
  errorMessage?: string;
  isSaving?: boolean;
  data?: {
    customerName: string;
    customerCode: string;
    date: string;
    time: string;
    noteBox: string;
    storeHeaderName: string;
    storePhone: string;
    storeHandle: string;
    paymentType: string;
    status: 'BELUM LUNAS' | 'LUNAS';
    dueDate: string;
    remainingDebt: number;
    paidAmount: number;
    totalAmount: number;
    items: AyamReceiptLineItem[];
    rawOcrText?: string;
  };
}

interface ReceiptOcrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToReceiptForm: (receiptData: {
    customerName: string;
    customerCode: string;
    date: string;
    noteBox: string;
    status: 'BELUM LUNAS' | 'LUNAS';
    items: AyamReceiptLineItem[];
    paymentType?: string;
    dueDate?: string;
  }) => void;
  onSaveDirectly: (receipt: AyamAnugrahReceipt) => Promise<void>;
}

export const ReceiptOcrScannerModal: React.FC<ReceiptOcrScannerModalProps> = ({
  isOpen,
  onClose,
  onApplyToReceiptForm,
  onSaveDirectly,
}) => {
  const [batchItems, setBatchItems] = useState<ReceiptBatchItem[]>([]);
  const [activeEditingItemId, setActiveEditingItemId] = useState<string | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [globalErrorMsg, setGlobalErrorMsg] = useState<string | null>(null);

  // Editing state for active item
  const [editingDraft, setEditingDraft] = useState<ReceiptBatchItem['data'] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Active item being edited in detail
  const activeItem = batchItems.find((it) => it.id === activeEditingItemId);

  // When active item changes, sync editing draft
  useEffect(() => {
    if (!isOpen) return;
    if (activeItem && activeItem.data) {
      setEditingDraft(JSON.parse(JSON.stringify(activeItem.data)));
    } else {
      setEditingDraft(null);
    }
  }, [isOpen, activeEditingItemId, activeItem]);

  // Handle files selection (supports multiple files)
  const handleFilesSelect = (fileList: FileList | File[]) => {
    setGlobalErrorMsg(null);
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));

    if (files.length === 0) {
      setGlobalErrorMsg('Harap pilih file gambar yang valid (JPG, PNG, atau WEBP).');
      return;
    }

    const newItems: ReceiptBatchItem[] = [];

    files.forEach((file) => {
      const reader = new FileReader();
      const tempId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const sizeStr = (file.size / 1024).toFixed(1) + ' KB';

      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setBatchItems((prev) => [
          ...prev,
          {
            id: tempId,
            fileName: file.name,
            fileSize: sizeStr,
            imagePreview: base64,
            mimeType: file.type || 'image/jpeg',
            status: 'pending',
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Run Queue Worker when pending items exist
  useEffect(() => {
    if (!isOpen) return;
    const processQueue = async () => {
      const nextPending = batchItems.find((it) => it.status === 'pending');
      if (!nextPending || isProcessingQueue) return;

      setIsProcessingQueue(true);

      // Mark as scanning
      setBatchItems((prev) =>
        prev.map((it) => (it.id === nextPending.id ? { ...it, status: 'scanning' } : it))
      );

      try {
        const res = await fetch('/api/ai/scan-receipt-ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: nextPending.imagePreview,
            mimeType: nextPending.mimeType,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || 'Gagal mengekstrak teks struk.');
        }

        const d = json.data;
        const items: AyamReceiptLineItem[] =
          Array.isArray(d.items) && d.items.length > 0
            ? d.items.map((it: any) => ({
                name: it.name || 'Ayam Gebrus',
                detailLabel: it.detailLabel || '',
                quantity: Number(it.quantity) || 1,
                unit: it.unit || 'kg',
                price: Number(it.price) || 0,
                total: Number(it.total) || (Number(it.quantity) || 1) * (Number(it.price) || 0),
              }))
            : [
                {
                  name: 'Ayam Gebrus',
                  detailLabel: d.customerCode ? `(${d.customerCode})` : '',
                  quantity: 50,
                  unit: 'kg',
                  price: 25500,
                  total: 1275000,
                },
              ];

        const totalAmount = Number(d.totalAmount) || items.reduce((s, it) => s + it.total, 0);
        const isLunas =
          String(d.status || '').toUpperCase().includes('LUNAS') &&
          !String(d.status || '').toUpperCase().includes('BELUM');

        const parsedData: NonNullable<ReceiptBatchItem['data']> = {
          customerName: d.customerName || 'Pelanggan Bon',
          customerCode: d.customerCode || '',
          date: d.date || getTodayDateString(),
          time: d.time || '00:57:55',
          noteBox: d.noteBox || '',
          storeHeaderName: d.storeHeaderName || 'aa anugrah',
          storePhone: d.storePhone || '085735144958',
          storeHandle: d.storeHandle || '@@ anugrah',
          paymentType: d.paymentType || 'kredit',
          status: isLunas ? 'LUNAS' : 'BELUM LUNAS',
          dueDate: d.dueDate || '09/11/2026',
          remainingDebt: isLunas
            ? 0
            : d.remainingDebt !== undefined
            ? Number(d.remainingDebt)
            : totalAmount,
          paidAmount: isLunas
            ? totalAmount
            : d.paidAmount !== undefined
            ? Number(d.paidAmount)
            : 0,
          totalAmount,
          items,
          rawOcrText: d.rawOcrText || '',
        };

        setBatchItems((prev) =>
          prev.map((it) =>
            it.id === nextPending.id
              ? { ...it, status: 'success', data: parsedData, errorMessage: undefined }
              : it
          )
        );
      } catch (err: any) {
        console.error('Scan error on item:', nextPending.id, err);
        setBatchItems((prev) =>
          prev.map((it) =>
            it.id === nextPending.id
              ? {
                  ...it,
                  status: 'error',
                  errorMessage: err.message || 'Gagal memproses gambar.',
                }
              : it
          )
        );
      } finally {
        setIsProcessingQueue(false);
      }
    };

    processQueue();
  }, [isOpen, batchItems, isProcessingQueue]);

  // Retry an individual failed item
  const handleRetryItem = (id: string) => {
    setBatchItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: 'pending', errorMessage: undefined } : it))
    );
  };

  // Convert failed item into manual draft for instant editing
  const handleCreateManualDraft = (id: string) => {
    setBatchItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              status: 'success',
              errorMessage: undefined,
              data: {
                customerName: 'Pelanggan Bon',
                customerCode: '30 e',
                date: getTodayDateString(),
                time: '12:00:00',
                noteBox: '',
                storeHeaderName: 'aa anugrah',
                storePhone: '085735144958',
                storeHandle: '@@ anugrah',
                paymentType: 'kredit',
                status: 'BELUM LUNAS',
                dueDate: '09/11/2026',
                remainingDebt: 1275000,
                paidAmount: 0,
                totalAmount: 1275000,
                rawOcrText: 'Input manual dari foto struk.',
                items: [
                  {
                    name: 'Ayam Gebrus',
                    detailLabel: '(30 ekor)',
                    quantity: 50.0,
                    unit: 'kg',
                    price: 25500,
                    total: 1275000,
                  },
                ],
              },
            }
          : it
      )
    );
    setActiveEditingItemId(id);
  };

  // Remove an item from the batch tray
  const handleRemoveBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((it) => it.id !== id));
    if (activeEditingItemId === id) {
      setActiveEditingItemId(null);
    }
  };

  // Load sample receipt into batch
  const handleLoadSample = async () => {
    try {
      setGlobalErrorMsg(null);
      const res = await fetch('/assets/aistudio/IMG-20261102-WA0018_1b8eb496.jpg');
      const blob = await res.blob();
      const reader = new FileReader();
      const tempId = `batch_${Date.now()}_sample`;
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setBatchItems((prev) => [
          ...prev,
          {
            id: tempId,
            fileName: 'Contoh_Struk_Ahmad_70e.jpg',
            fileSize: '142.5 KB',
            imagePreview: base64,
            mimeType: 'image/jpeg',
            status: 'pending',
          },
        ]);
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      console.error(err);
      setGlobalErrorMsg('Gagal memuat contoh struk.');
    }
  };

  // 1. SAVE INDIVIDUAL FINISHED RECEIPT IMMEDIATELY
  const handleSaveIndividual = async (item: ReceiptBatchItem) => {
    if (!item.data || item.status === 'saved' || item.isSaving) return;

    // Mark as saving
    setBatchItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, isSaving: true } : it))
    );

    try {
      const d = item.data;
      const receiptToSave: AyamAnugrahReceipt = {
        id: `rcp_ocr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: 'guest',
        receiptNumber: `INV-AA-${Date.now().toString().slice(-4)}`,
        date: d.date,
        time: d.time || '00:57:55',
        customerName: d.customerName,
        customerCode: d.customerCode,
        noteBox: d.noteBox,
        items: d.items,
        totalAmount: d.totalAmount,
        status: d.status,
        paymentType: d.paymentType || 'kredit',
        dueDate: d.dueDate || '09/11/2026',
        remainingDebt: d.remainingDebt,
        paidAmount: d.paidAmount,
        historyDate: '02/11/2026',
        storeHeaderName: d.storeHeaderName || 'aa anugrah',
        storePhone: d.storePhone || '085735144958',
        storeHandle: d.storeHandle || '@@ anugrah',
        createdAt: new Date().toISOString(),
      };

      await onSaveDirectly(receiptToSave);

      // Mark this specific item as saved
      setBatchItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'saved', isSaving: false } : it))
      );
    } catch (err: any) {
      console.error(err);
      setBatchItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, isSaving: false, errorMessage: 'Gagal menyimpan: ' + err.message }
            : it
        )
      );
    }
  };

  // 2. SAVE ALL FINISHED READY RECEIPTS AT ONCE
  const handleSaveAllReady = async () => {
    const readyItems = batchItems.filter((it) => it.status === 'success');
    if (readyItems.length === 0) return;

    setIsBulkSaving(true);
    for (const item of readyItems) {
      await handleSaveIndividual(item);
    }
    setIsBulkSaving(false);
  };

  // Save changes from editing draft back to the batch item
  const handleSaveDraftChanges = () => {
    if (!activeEditingItemId || !editingDraft) return;

    const newTotal = editingDraft.items.reduce((s, it) => s + it.total, 0);
    const updatedData = {
      ...editingDraft,
      totalAmount: newTotal,
      remainingDebt: editingDraft.status === 'LUNAS' ? 0 : newTotal,
      paidAmount: editingDraft.status === 'LUNAS' ? newTotal : editingDraft.paidAmount,
    };

    setBatchItems((prev) =>
      prev.map((it) =>
        it.id === activeEditingItemId ? { ...it, data: updatedData } : it
      )
    );
    setActiveEditingItemId(null);
  };

  // Transfer item directly into the main "Buat Struk Baru" form modal
  const handleTransferItemToMainForm = (item: ReceiptBatchItem) => {
    if (!item.data) return;
    onApplyToReceiptForm({
      customerName: item.data.customerName,
      customerCode: item.data.customerCode,
      date: item.data.date,
      noteBox: item.data.noteBox,
      status: item.data.status,
      items: item.data.items,
      paymentType: item.data.paymentType,
      dueDate: item.data.dueDate,
    });
    onClose();
  };

  // Edit draft item changes
  const handleDraftItemChange = (
    index: number,
    field: keyof AyamReceiptLineItem,
    val: any
  ) => {
    if (!editingDraft) return;
    const nextItems = editingDraft.items.map((it, idx) => {
      if (idx !== index) return it;
      const updated = { ...it, [field]: val };
      if (field === 'quantity' || field === 'price') {
        const q = field === 'quantity' ? Number(val) : it.quantity;
        const p = field === 'price' ? Number(val) : it.price;
        updated.total = Math.round(q * p);
      }
      return updated;
    });

    const newTotal = nextItems.reduce((s, it) => s + it.total, 0);
    setEditingDraft({
      ...editingDraft,
      items: nextItems,
      totalAmount: newTotal,
      remainingDebt: editingDraft.status === 'LUNAS' ? 0 : newTotal,
    });
  };

  const handleAddDraftItem = () => {
    if (!editingDraft) return;
    const newItem: AyamReceiptLineItem = {
      name: 'Item Tambahan',
      detailLabel: '',
      quantity: 1,
      unit: 'kg',
      price: 25000,
      total: 25000,
    };
    const nextItems = [...editingDraft.items, newItem];
    const newTotal = nextItems.reduce((s, it) => s + it.total, 0);
    setEditingDraft({
      ...editingDraft,
      items: nextItems,
      totalAmount: newTotal,
      remainingDebt: editingDraft.status === 'LUNAS' ? 0 : newTotal,
    });
  };

  const handleRemoveDraftItem = (index: number) => {
    if (!editingDraft) return;
    const nextItems = editingDraft.items.filter((_, idx) => idx !== index);
    const newTotal = nextItems.reduce((s, it) => s + it.total, 0);
    setEditingDraft({
      ...editingDraft,
      items: nextItems,
      totalAmount: newTotal,
      remainingDebt: editingDraft.status === 'LUNAS' ? 0 : newTotal,
    });
  };

  // Stats
  const totalCount = batchItems.length;
  const successCount = batchItems.filter((it) => it.status === 'success').length;
  const savedCount = batchItems.filter((it) => it.status === 'saved').length;
  const scanningCount = batchItems.filter((it) => it.status === 'scanning').length;
  const pendingCount = batchItems.filter((it) => it.status === 'pending').length;

  const totalBatchRupiah = batchItems.reduce((sum, it) => {
    return sum + (it.data ? it.data.totalAmount : 0);
  }, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[94vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-700 via-amber-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-amber-500/25 text-amber-200 rounded-2xl border border-amber-400/30">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  Upload Banyak Struk Sekaligus & Scan OCR AI
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-400/25 text-amber-200 border border-amber-300/30 rounded-full flex items-center gap-1 shadow-xs">
                  <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                  Gemini Flash Lite (Ringan & Cepat)
                </span>
              </div>
              <p className="text-xs text-amber-100/80">
                Pilih atau foto banyak bon pembayaran customer sekaligus. Diproses cepat & efisien dengan model Gemini Flash Lite dengan fitur edit & simpan instan.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Control Bar & Queue Summary */}
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-xs active:scale-95"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Pilih Banyak Foto Struk</span>
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-xs active:scale-95"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Ambil Foto HP</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 text-amber-900 border border-amber-300 rounded-xl font-bold transition-all shadow-2xs"
              title="Tambahkan foto struk contoh Ahmad 70 e ke antrean"
            >
              <Receipt className="w-3.5 h-3.5 text-amber-600" />
              <span>+ Contoh Struk (Ahmad 70 e)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesSelect(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesSelect(e.target.files);
                if (cameraInputRef.current) cameraInputRef.current.value = '';
              }}
            />
          </div>

          {/* Quick Counter Badges */}
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-gray-700 shadow-2xs">
              Total: <strong>{totalCount}</strong> Foto
            </span>
            {successCount > 0 && (
              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-extrabold shadow-2xs">
                Siap Simpan: <strong>{successCount}</strong>
              </span>
            )}
            {savedCount > 0 && (
              <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 font-extrabold shadow-2xs">
                Tersimpan: <strong>{savedCount}</strong>
              </span>
            )}
            {(scanningCount > 0 || pendingCount > 0) && (
              <span className="px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 flex items-center gap-1 shadow-2xs animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                <span>Memindai ({scanningCount + pendingCount})...</span>
              </span>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {globalErrorMsg && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{globalErrorMsg}</span>
          </div>
        )}

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Empty Upload State */}
          {batchItems.length === 0 && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) handleFilesSelect(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-3xl p-8 sm:p-14 text-center bg-gray-50/70 hover:bg-amber-50/20 transition-all cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <Upload className="w-8 h-8" />
              </div>
              <h4 className="text-base font-extrabold text-gray-900">
                Pilih atau Tarik Banyak Foto Bon / Struk Sekaligus
              </h4>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                Anda dapat memilih 5, 10, atau puluhan foto struk tagihan pelanggan sekaligus. Sistem akan memindainya secara otomatis, dan setiap struk yang selesai bisa langsung Anda simpan atau edit.
              </p>

              <div className="flex items-center justify-center gap-3 pt-5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-600/25 active:scale-95"
                >
                  Pilih Foto dari Komputer / HP
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoadSample();
                  }}
                  className="px-4 py-2.5 bg-white hover:bg-gray-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-2xs"
                >
                  Gunakan Contoh Struk
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE EDITING MODAL / DRAWER FOR A SINGLE RECEIPT */}
          {activeItem && editingDraft && (
            <div className="p-4 sm:p-5 bg-amber-50/80 border-2 border-amber-300 rounded-3xl space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-600 text-white rounded-xl">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-amber-950">
                      Edit & Verifikasi Data Struk: {editingDraft.customerName} ({activeItem.fileName})
                    </h4>
                    <p className="text-xs text-amber-800">
                      Koreksi nama, kode, ekor, harga, bobot kg, atau item sebelum disimpan
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveEditingItemId(null)}
                  className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-amber-200/50 rounded-xl transition-colors"
                  title="Tutup Panel Edit"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid Form Fields */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left: Receipt Photo Thumbnail */}
                <div className="lg:col-span-4 bg-gray-900 rounded-2xl p-2.5 flex flex-col items-center justify-center text-white overflow-hidden shadow-inner">
                  <div className="text-[10px] text-amber-300 font-bold mb-1.5 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>Foto Bon Pembayaran ({activeItem.fileName})</span>
                  </div>
                  <div className="max-h-72 overflow-auto rounded-xl w-full flex justify-center bg-black/40 p-1">
                    <img
                      src={activeItem.imagePreview}
                      alt="Struk Bon"
                      className="max-h-68 w-auto object-contain rounded-lg"
                    />
                  </div>
                </div>

                {/* Right: Editable Inputs */}
                <div className="lg:col-span-8 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="font-bold text-gray-700">Nama Pelanggan</label>
                      <input
                        type="text"
                        value={editingDraft.customerName}
                        onChange={(e) =>
                          setEditingDraft({ ...editingDraft, customerName: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl font-bold text-gray-900 focus:border-amber-500"
                        placeholder="Nama Customer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-gray-700">Kode / Ekor</label>
                      <input
                        type="text"
                        value={editingDraft.customerCode}
                        onChange={(e) =>
                          setEditingDraft({ ...editingDraft, customerCode: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl font-bold text-amber-800 focus:border-amber-500"
                        placeholder="70 e / #09"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-gray-700">Tanggal Struk</label>
                      <input
                        type="text"
                        value={editingDraft.date}
                        onChange={(e) =>
                          setEditingDraft({ ...editingDraft, date: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-gray-900 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-700">Kotak Keterangan / Pita</label>
                      <input
                        type="text"
                        value={editingDraft.noteBox}
                        onChange={(e) =>
                          setEditingDraft({ ...editingDraft, noteBox: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-gray-900 focus:border-amber-500"
                        placeholder="Ket: Pita Putih"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-gray-700">Status Pembayaran</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingDraft({
                              ...editingDraft,
                              status: 'BELUM LUNAS',
                              remainingDebt: editingDraft.totalAmount,
                              paidAmount: 0,
                            })
                          }
                          className={`py-1.5 px-2 rounded-xl border font-bold text-[11px] transition-all ${
                            editingDraft.status === 'BELUM LUNAS'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                              : 'bg-white text-gray-700 border-gray-300'
                          }`}
                        >
                          [ BELUM LUNAS ]
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setEditingDraft({
                              ...editingDraft,
                              status: 'LUNAS',
                              remainingDebt: 0,
                              paidAmount: editingDraft.totalAmount,
                            })
                          }
                          className={`py-1.5 px-2 rounded-xl border font-bold text-[11px] transition-all ${
                            editingDraft.status === 'LUNAS'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-gray-700 border-gray-300'
                          }`}
                        >
                          [ LUNAS ]
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                      <span>Rincian Produk ({editingDraft.items.length} Baris)</span>
                      <button
                        type="button"
                        onClick={handleAddDraftItem}
                        className="flex items-center gap-1 text-amber-700 hover:text-amber-800 text-[11px]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Baris</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {editingDraft.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-white rounded-xl border border-gray-200 space-y-1.5 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={it.name}
                              onChange={(e) => handleDraftItemChange(idx, 'name', e.target.value)}
                              placeholder="Nama Item"
                              className="flex-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-900"
                            />
                            <input
                              type="text"
                              value={it.detailLabel || ''}
                              onChange={(e) => handleDraftItemChange(idx, 'detailLabel', e.target.value)}
                              placeholder="(70 ekor)"
                              className="w-24 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftItem(idx)}
                              className="p-1 text-gray-400 hover:text-rose-600 rounded-lg"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold block">Bobot/Jumlah</span>
                              <input
                                type="number"
                                step="0.1"
                                value={it.quantity}
                                onChange={(e) => handleDraftItemChange(idx, 'quantity', e.target.value)}
                                className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono font-bold"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold block">Harga/Satuan</span>
                              <input
                                type="number"
                                value={it.price}
                                onChange={(e) => handleDraftItemChange(idx, 'price', e.target.value)}
                                className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono font-bold"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold block">Subtotal</span>
                              <div className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg font-mono font-extrabold text-amber-950 text-right">
                                {formatAngkaIndo(it.total)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Edit Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200">
                    <div className="text-xs">
                      <span className="text-gray-500 font-bold">Total: </span>
                      <strong className="text-sm font-black font-mono text-amber-950">
                        {formatRupiah(editingDraft.totalAmount)}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTransferItemToMainForm(activeItem)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-xs font-bold transition-all shadow-2xs"
                        title="Buka form 'Buat Struk Baru' bawaan"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        <span>Form Struk Lengkap</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveDraftChanges}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan Hasil Koreksi</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LIST OF BATCH ITEMS */}
          {batchItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700 px-1">
                <span>Daftar Foto Bon Dalam Antrean ({batchItems.length} Struk):</span>
                <span className="text-amber-900 font-extrabold">
                  Total Nilai Terbaca: {formatRupiah(totalBatchRupiah)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {batchItems.map((item, idx) => {
                  const isScanningItem = item.status === 'scanning';
                  const isSuccessItem = item.status === 'success';
                  const isSavedItem = item.status === 'saved';
                  const isErrorItem = item.status === 'error';
                  const isPendingItem = item.status === 'pending';

                  return (
                    <div
                      key={item.id}
                      className={`relative bg-white rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-all shadow-2xs ${
                        isSavedItem
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : isSuccessItem
                          ? 'border-amber-200 hover:border-amber-400 bg-white'
                          : isScanningItem
                          ? 'border-amber-300 bg-amber-50/30'
                          : isErrorItem
                          ? 'border-rose-200 bg-rose-50/20'
                          : 'border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      {/* Item Top Row: Thumbnail + Info */}
                      <div className="flex items-start gap-3">
                        {/* Thumbnail */}
                        <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-gray-900 border border-gray-200 shrink-0 flex items-center justify-center">
                          <img
                            src={item.imagePreview}
                            alt={item.fileName}
                            className="w-full h-full object-cover"
                          />
                          {isScanningItem && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <RefreshCw className="w-5 h-5 text-amber-300 animate-spin" />
                            </div>
                          )}
                          {isSavedItem && (
                            <div className="absolute inset-0 bg-emerald-900/60 flex items-center justify-center">
                              <CheckCircle className="w-6 h-6 text-emerald-300" />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-extrabold text-xs text-gray-900 truncate" title={item.fileName}>
                              #{idx + 1}. {item.data?.customerName || item.fileName}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveBatchItem(item.id)}
                              className="text-gray-400 hover:text-rose-600 p-1 rounded-lg shrink-0"
                              title="Hapus dari antrean"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Status Pill */}
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {isScanningItem && (
                              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1 animate-pulse">
                                <Sparkles className="w-3 h-3 text-amber-600 animate-spin" />
                                <span>Sedang Scan OCR...</span>
                              </span>
                            )}
                            {isPendingItem && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Menunggu Giliran</span>
                              </span>
                            )}
                            {isSuccessItem && (
                              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>Scan Selesai — Siap Disimpan</span>
                              </span>
                            )}
                            {isSavedItem && (
                              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-800 rounded-full flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-blue-600" />
                                <span>Tersimpan di Galeri Struk</span>
                              </span>
                            )}
                            {isErrorItem && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-full flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                <span>Gagal Pindai</span>
                              </span>
                            )}
                          </div>

                          {/* Extracted preview content */}
                          {item.data && (
                            <div className="mt-2 text-xs space-y-0.5">
                              <div className="flex items-center justify-between text-[11px] text-gray-600">
                                <span>
                                  Kode: <strong>{item.data.customerCode || '-'}</strong> • {item.data.date}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded font-extrabold text-[9px] ${
                                    item.data.status === 'LUNAS'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {item.data.status}
                                </span>
                              </div>

                              <div className="flex items-baseline justify-between pt-0.5">
                                <span className="text-[11px] text-gray-500">
                                  {item.data.items.length} item komoditas
                                </span>
                                <span className="font-black font-mono text-sm text-emerald-800">
                                  {formatRupiah(item.data.totalAmount)}
                                </span>
                              </div>
                            </div>
                          )}

                          {isErrorItem && (
                            <div className="mt-2 space-y-1.5">
                              <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-xl flex items-center justify-between gap-2">
                                <span className="truncate">{item.errorMessage}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRetryItem(item.id)}
                                  className="underline font-bold text-rose-800 hover:text-rose-900 shrink-0"
                                >
                                  Coba Lagi
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCreateManualDraft(item.id)}
                                className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>⚡ Buka Form & Lengkapi Data Bon Ini</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Item Bottom Action Buttons (APABILA SELESAI SCAN BISA LANGSUNG DISIMPAN ATAU DIEDIT) */}
                      {(isSuccessItem || isSavedItem) && item.data && (
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                          {/* Edit / Koreksi Button */}
                          <button
                            type="button"
                            onClick={() => setActiveEditingItemId(item.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl font-bold transition-all shadow-2xs text-[11px] active:scale-95"
                            title="Edit & koreksi data struk ini"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>Edit / Koreksi</span>
                          </button>

                          {/* Individual Save Button */}
                          {isSavedItem ? (
                            <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-900 rounded-xl font-extrabold text-[11px]">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Sudah Masuk Galeri</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSaveIndividual(item)}
                              disabled={item.isSaving}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-extrabold text-[11px] transition-all shadow-sm active:scale-95"
                              title="Simpan struk ini langsung ke sistem dan database"
                            >
                              {item.isSaving ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Menyimpan...</span>
                                </>
                              ) : (
                                <>
                                  <Save className="w-3.5 h-3.5" />
                                  <span>Simpan Struk Ini</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {batchItems.length > 0
                ? `${savedCount} dari ${batchItems.length} struk telah tersimpan ke galeri.`
                : 'Pilih beberapa foto struk bon untuk memulai pemindaian massal.'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Tutup
            </button>

            {/* SAVE ALL READY BUTTON */}
            {successCount > 0 && (
              <button
                type="button"
                onClick={handleSaveAllReady}
                disabled={isBulkSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-emerald-600/25 active:scale-95"
              >
                {isBulkSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan Semua Struk...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Semua yang Selesai ({successCount} Struk)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
