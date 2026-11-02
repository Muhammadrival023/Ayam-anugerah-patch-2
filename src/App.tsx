import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { TransactionList } from './components/TransactionList';
import { BillReminders } from './components/BillReminders';
import { ExcelTableInput } from './components/ExcelTableInput';
import { TransactionModal } from './components/TransactionModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ExcelManager } from './components/ExcelManager';
import { CategoryManager } from './components/CategoryManager';
import { AyamReceiptGallery } from './components/AyamReceiptGallery';
import { ClearDataModal } from './components/ClearDataModal';
import { LoginDashboard } from './components/LoginDashboard';
import { Transaction, TransactionType } from './types';
import {
  FileSpreadsheet,
  PlusCircle,
  Tag,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Printer,
  ChevronRight,
  Shield,
  Table,
  Receipt,
  Trash2,
} from 'lucide-react';

function MainApp() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { transactions, summary, restoreSampleData, loading } = useFinance();

  const [activeTab, setActiveTab] = useState<'receipts' | 'excel-table' | 'dashboard' | 'transactions' | 'bills'>('receipts');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalType, setAddModalType] = useState<TransactionType>('income');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-gray-300">Memeriksa sesi login perangkat...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginDashboard />;
  }

  const handleOpenAddModal = (type: TransactionType = 'income') => {
    setEditingTransaction(null);
    setAddModalType(type);
    setIsAddModalOpen(true);
  };

  const handleEditTransaction = (txn: Transaction) => {
    setEditingTransaction(txn);
    setAddModalType(txn.type);
    setIsAddModalOpen(true);
  };

  const handleViewReceipt = (txn: Transaction) => {
    setReceiptTransaction(txn);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddModal={() => handleOpenAddModal('income')}
        onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
        onOpenExcelModal={() => setIsExcelModalOpen(true)}
        onOpenClearModal={() => setIsClearModalOpen(true)}
      />

      {/* Overdue Bills Top Banner Warning */}
      {summary.overdueBillsCount > 0 && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-semibold shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-200 shrink-0" />
              <span>
                Perhatian: Terdapat <strong>{summary.overdueBillsCount}</strong> nota pengiriman ayam yang telah melewati tanggal tempo pembayaran!
              </span>
            </div>
            <button
              onClick={() => setActiveTab('bills')}
              className="underline hover:text-rose-100 font-bold shrink-0 text-[11px]"
            >
              Lihat Piutang Pelanggan →
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
            <h3 className="text-sm font-bold text-gray-700">Menghubungkan Data Gudang Ayam Anugerah...</h3>
            <p className="text-xs text-gray-400 mt-1">Mengambil arsip transaksi, tagihan struk, dan data karkas.</p>
          </div>
        ) : (
          <>
            {activeTab === 'receipts' && (
              <AyamReceiptGallery onOpenClearModal={() => setIsClearModalOpen(true)} />
            )}

            {activeTab === 'excel-table' && (
              <ExcelTableInput onSuccessSave={() => setActiveTab('receipts')} />
            )}

            {activeTab === 'dashboard' && (
              <Dashboard
                onOpenAddModal={handleOpenAddModal}
                onOpenExcelModal={() => setIsExcelModalOpen(true)}
                onNavigateToBills={() => setActiveTab('bills')}
                onNavigateToReceipts={() => setActiveTab('receipts')}
                onOpenClearModal={() => setIsClearModalOpen(true)}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionList
                onOpenAddModal={handleOpenAddModal}
                onEditTransaction={handleEditTransaction}
                onViewReceipt={handleViewReceipt}
                onOpenClearModal={() => setIsClearModalOpen(true)}
              />
            )}

            {activeTab === 'bills' && <BillReminders />}
          </>
        )}
      </main>

      {/* Floating Quick Action Bar for Tablet & Desktop */}
      <div className="fixed bottom-6 right-6 z-30 flex items-center gap-2.5 print:hidden">
        <button
          onClick={() => setActiveTab('receipts')}
          title="Struk Tagihan Harian Gudang"
          className="p-3 bg-white text-amber-800 hover:text-amber-600 rounded-full shadow-lg border border-gray-200 hover:scale-105 active:scale-95 transition-all"
        >
          <Receipt className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTab('excel-table')}
          title="Input Excel & Analisa AI"
          className="p-3 bg-white text-emerald-800 hover:text-emerald-600 rounded-full shadow-lg border border-gray-200 hover:scale-105 active:scale-95 transition-all"
        >
          <FileSpreadsheet className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleOpenAddModal('income')}
          title="Catat Penjualan Ayam Cepat"
          className="flex items-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-full shadow-xl shadow-emerald-700/30 hover:scale-105 active:scale-95 transition-all"
        >
          <PlusCircle className="w-5 h-5" />
          <span>+ Catat Penjualan</span>
        </button>
      </div>

      {/* Global Modals */}
      <TransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialType={addModalType}
        editingTransaction={editingTransaction}
        onTransactionSaved={(txn) => {
          // Open receipt directly if user wants
          setReceiptTransaction(txn);
        }}
        onOpenCategoryManager={() => {
          setIsAddModalOpen(false);
          setIsCategoryModalOpen(true);
        }}
      />

      <ReceiptModal
        transaction={receiptTransaction}
        onClose={() => setReceiptTransaction(null)}
      />

      <ExcelManager
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
      />

      <CategoryManager
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
      />

      <ClearDataModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
      />

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-gray-200/80 bg-white text-xs text-gray-500 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800">Ayam Anugerah</span>
            <span>&bull;</span>
            <span>Sistem Tagihan, Pembayaran & Arus Kas Ayam Potong</span>
          </div>

          <div className="flex items-center gap-4">
            {transactions.length === 0 && (
              <button
                onClick={restoreSampleData}
                className="flex items-center gap-1.5 text-emerald-700 font-semibold hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Isi Data Contoh Demo</span>
              </button>
            )}
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="hover:text-gray-800 transition-colors"
            >
              Kategori
            </button>
            <button
              onClick={() => setIsExcelModalOpen(true)}
              className="hover:text-gray-800 transition-colors"
            >
              Ekspor/Impor
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <MainApp />
      </FinanceProvider>
    </AuthProvider>
  );
}
