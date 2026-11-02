import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import { Transaction, Category, Bill, FinancialSummary, AyamAnugrahReceipt } from '../types/index';
import { DEFAULT_CATEGORIES, SAMPLE_AYAM_RECEIPTS, generateReceiptNumber, getTodayDateString } from '../data/defaults';

interface FinanceContextType {
  transactions: Transaction[];
  categories: Category[];
  bills: Bill[];
  receipts: AyamAnugrahReceipt[];
  loading: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  summary: FinancialSummary;
  addTransaction: (data: Omit<Transaction, 'id' | 'userId' | 'createdAt'>) => Promise<string>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (data: Omit<Category, 'id' | 'userId' | 'createdAt'>) => Promise<string>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addBill: (data: Omit<Bill, 'id' | 'userId' | 'createdAt'>) => Promise<string>;
  updateBill: (id: string, data: Partial<Bill>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  markBillAsPaid: (billId: string, recordAsExpense?: boolean) => Promise<void>;
  importTransactions: (newTxns: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[]) => Promise<number>;
  restoreSampleData: () => Promise<void>;
  deleteTransactionsBatch: (ids: string[]) => Promise<number>;
  deleteTransactionsByPeriod: (startDate: string, endDate: string) => Promise<number>;
  clearAllFinancialData: (scope?: 'all' | 'transactions_only' | 'bills_only') => Promise<void>;
  addReceipt: (data: AyamAnugrahReceipt) => Promise<string>;
  updateReceipt: (id: string, data: Partial<AyamAnugrahReceipt>) => Promise<void>;
  deleteReceipt: (id: string) => Promise<void>;
  deleteReceiptsBatch: (ids: string[]) => Promise<number>;
  clearReceipts: (type?: 'all' | 'belum_lunas' | 'lunas') => Promise<number>;
  restoreSampleReceipts: () => Promise<void>;
  importReceipts: (
    newReceipts: AyamAnugrahReceipt[],
    mode: 'replace' | 'append',
    syncToFinance?: boolean
  ) => Promise<number>;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};

const LOCAL_STORAGE_TXN_KEY = 'ayam_anugerah_txns_v2';
const LOCAL_STORAGE_CAT_KEY = 'ayam_anugerah_cats_v2';
const LOCAL_STORAGE_BILL_KEY = 'ayam_anugerah_bills_v2';
const LOCAL_STORAGE_RECEIPT_KEY = 'ayam_anugerah_receipts_v1';

function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return '' as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        cleaned[key] = '';
      } else if (value === null) {
        cleaned[key] = null;
      } else if (typeof value === 'object') {
        cleaned[key] = cleanFirestoreData(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
  return obj;
}

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, adminUser, isAuthenticated, loading: authLoading } = useAuth();

  const isCloudActive = Boolean(user || isAuthenticated);
  const currentUid = user ? user.uid : (adminUser ? 'admin_ayamanugerah' : 'guest');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [receipts, setReceipts] = useState<AyamAnugrahReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Sync / Load data based on Auth state
  useEffect(() => {
    if (authLoading) return;

    if (isCloudActive) {
      // Authenticated with Admin or Google Firebase -> Realtime listeners across devices
      setIsSyncing(true);

      const txnPath = 'transactions';
      const catPath = 'categories';
      const billPath = 'bills';
      const receiptPath = 'receipts';

      const qTxn = collection(db, txnPath);
      const qCat = collection(db, catPath);
      const qBill = collection(db, billPath);
      const qReceipt = collection(db, receiptPath);

      // 1. Transactions Listener
      const unsubTxn = onSnapshot(
        qTxn,
        (snapshot) => {
          const list: Transaction[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as Transaction);
          });
          list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTransactions(list);
          setLastSyncTime(new Date());
          setIsSyncing(false);
          setLoading(false);
        },
        (error) => {
          setIsSyncing(false);
          setLoading(false);
          handleFirestoreError(error, OperationType.LIST, txnPath);
        }
      );

      // 2. Categories Listener
      const unsubCat = onSnapshot(
        qCat,
        async (snapshot) => {
          if (snapshot.empty) {
            try {
              const batch = writeBatch(db);
              DEFAULT_CATEGORIES.forEach((cat) => {
                const newCatRef = doc(collection(db, 'categories'));
                batch.set(newCatRef, {
                  ...cat,
                  userId: currentUid,
                  createdAt: new Date().toISOString(),
                });
              });
              await batch.commit();
            } catch (err) {
              console.warn('Seeding default categories error:', err);
            }
          } else {
            const list: Category[] = [];
            snapshot.forEach((d) => {
              list.push({ id: d.id, ...d.data() } as Category);
            });
            setCategories(list);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, catPath);
        }
      );

      // 3. Bills Listener
      const unsubBill = onSnapshot(
        qBill,
        (snapshot) => {
          const list: Bill[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as Bill);
          });
          list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
          setBills(list);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, billPath);
        }
      );

      // 4. Receipts Listener (Ayam Anugerah Warehouse Invoices)
      const unsubReceipt = onSnapshot(
        qReceipt,
        async (snapshot) => {
          const list: AyamAnugrahReceipt[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as any;
            list.push({
              ...data,
              id: d.id, // Primary key is always Firestore doc ID
              docId: d.id,
              firestoreDocId: d.id,
              originalId: data.id || d.id,
            } as AyamAnugrahReceipt);
          });
          list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setReceipts(list);

          // IMPORTANT: NEVER re-seed if the user has intentionally cleared or initialized the receipts!
          const isInitialized = localStorage.getItem('ayamanugrah_receipts_initialized');
          const isCleared = localStorage.getItem('ayamanugrah_receipts_cleared');

          if (snapshot.empty && !isInitialized && !isCleared) {
            localStorage.setItem('ayamanugrah_receipts_initialized', 'true');
            try {
              const batch = writeBatch(db);
              SAMPLE_AYAM_RECEIPTS.forEach((r) => {
                const newReceiptRef = doc(collection(db, 'receipts'));
                batch.set(newReceiptRef, {
                  ...r,
                  userId: currentUid,
                });
              });
              await batch.commit();
            } catch (err) {
              console.warn('Initial seeding error:', err);
            }
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, receiptPath);
        }
      );

      return () => {
        unsubTxn();
        unsubCat();
        unsubBill();
        unsubReceipt();
      };
    } else {
      // Guest mode (Local Storage fallback for instant offline exploration)
      try {
        const savedTxns = localStorage.getItem(LOCAL_STORAGE_TXN_KEY);
        const savedCats = localStorage.getItem(LOCAL_STORAGE_CAT_KEY);
        const savedBills = localStorage.getItem(LOCAL_STORAGE_BILL_KEY);
        const savedReceipts = localStorage.getItem(LOCAL_STORAGE_RECEIPT_KEY);

        if (savedReceipts !== null) {
          try {
            setReceipts(JSON.parse(savedReceipts));
          } catch {
            setReceipts([]);
          }
        } else {
          const isCleared = localStorage.getItem('ayamanugrah_receipts_cleared');
          if (!isCleared) {
            setReceipts(SAMPLE_AYAM_RECEIPTS);
            localStorage.setItem(LOCAL_STORAGE_RECEIPT_KEY, JSON.stringify(SAMPLE_AYAM_RECEIPTS));
            localStorage.setItem('ayamanugrah_receipts_initialized', 'true');
          } else {
            setReceipts([]);
            localStorage.setItem(LOCAL_STORAGE_RECEIPT_KEY, JSON.stringify([]));
          }
        }

        if (savedCats) {
          setCategories(JSON.parse(savedCats));
        } else {
          // Default categories
          const initialCats: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
            id: `cat_local_${i + 1}`,
            userId: 'guest',
            ...c,
            createdAt: new Date().toISOString(),
          }));
          setCategories(initialCats);
          localStorage.setItem(LOCAL_STORAGE_CAT_KEY, JSON.stringify(initialCats));
        }

        if (savedTxns) {
          setTransactions(JSON.parse(savedTxns));
        } else {
          // Initialize sample poultry transactions for Ayam Anugerah
          const today = getTodayDateString();
          const sampleTxns: Transaction[] = [
            {
              id: 'txn_sample_1',
              userId: 'guest',
              type: 'income',
              amount: 22527500,
              category: 'Penjualan Ayam Gebrus',
              description: 'Penjualan Ayam Broiler 470 Ekor (Pak Ade #11)',
              date: today,
              paymentMethod: 'Transfer BCA Ayam Anugerah',
              receiptNumber: 'INV-AA-11',
              note: '860.9 kg @ 25.000 + 470 bj ati + 20 kg usus',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'txn_sample_2',
              userId: 'guest',
              type: 'income',
              amount: 1410300,
              category: 'Penjualan Ayam Gebrus',
              description: 'Penjualan Ayam Gebrus 30 Ekor (Moris #09)',
              date: today,
              paymentMethod: 'Tunai Kasir Gudang',
              receiptNumber: 'INV-AA-09',
              note: '50.6 kg @ 25.500, ati 30 bj, usus 5 kg',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'txn_sample_3',
              userId: 'guest',
              type: 'income',
              amount: 2686200,
              category: 'Penjualan Ayam Gebrus',
              description: 'Penjualan Ayam Gebrus 60 Ekor (Rio #12)',
              date: today,
              paymentMethod: 'Transfer BCA Ayam Anugerah',
              receiptNumber: 'INV-AA-12',
              note: '102.4 kg @ 25.500, ati 50 bj',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'txn_sample_4',
              userId: 'guest',
              type: 'expense',
              amount: 16500000,
              category: 'Beli Ayam Hidup Peternak',
              description: 'Pembelian Ayam Broiler Hidup Kandang Subang (800 Ekor)',
              date: today,
              paymentMethod: 'Transfer BCA Ayam Anugerah',
              receiptNumber: generateReceiptNumber(),
              note: 'Muatan truk pendingin masuk jam 02:00',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'txn_sample_5',
              userId: 'guest',
              type: 'expense',
              amount: 600000,
              category: 'Operasional Pemotongan & Es',
              description: 'Pembelian Es Balok 30 Balok & Garam Pendingin',
              date: today,
              paymentMethod: 'Tunai Kasir Gudang',
              receiptNumber: generateReceiptNumber(),
              note: 'Untuk cold box & keranjang kirim karkas',
              createdAt: new Date().toISOString(),
            },
          ];
          setTransactions(sampleTxns);
          localStorage.setItem(LOCAL_STORAGE_TXN_KEY, JSON.stringify(sampleTxns));
        }

        if (savedBills) {
          setBills(JSON.parse(savedBills));
        } else {
          const sampleBills: Bill[] = [
            {
              id: 'bill_sample_1',
              userId: 'guest',
              title: 'Tagihan Piutang Ayam - Nanjung (#10)',
              amount: 1967250,
              category: 'Pelunasan Tagihan Gudang',
              dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
              repeatFrequency: 'once',
              status: 'unpaid',
              reminderDaysBefore: 1,
              notes: 'Ket: Pita Putih. 40 ekor (69.5 kg), Ati 80 bj, Usus 5 kg',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'bill_sample_2',
              userId: 'guest',
              title: 'Tagihan Piutang Ayam - Mang Asep (#08)',
              amount: 2744000,
              category: 'Pelunasan Tagihan Gudang',
              dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
              repeatFrequency: 'once',
              status: 'unpaid',
              reminderDaysBefore: 1,
              notes: '65 ekor (106 kg), Ati 70 bj, Usus 3 kg',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'bill_sample_3',
              userId: 'guest',
              title: 'Tagihan Piutang Ayam - Saar (#14)',
              amount: 616500,
              category: 'Pelunasan Tagihan Gudang',
              dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
              repeatFrequency: 'once',
              status: 'unpaid',
              reminderDaysBefore: 1,
              notes: '15 ekor (23 kg), Ati 20 bj',
              createdAt: new Date().toISOString(),
            },
          ];
          setBills(sampleBills);
          localStorage.setItem(LOCAL_STORAGE_BILL_KEY, JSON.stringify(sampleBills));
        }
      } catch (e) {
        console.error('Local storage reading error:', e);
      } finally {
        setLoading(false);
      }
    }
  }, [user, authLoading]);

  // Synchronize local changes to LocalStorage when in guest mode
  useEffect(() => {
    if (!user && !loading) {
      try {
        localStorage.setItem(LOCAL_STORAGE_TXN_KEY, JSON.stringify(transactions));
        localStorage.setItem(LOCAL_STORAGE_CAT_KEY, JSON.stringify(categories));
        localStorage.setItem(LOCAL_STORAGE_BILL_KEY, JSON.stringify(bills));
        localStorage.setItem(LOCAL_STORAGE_RECEIPT_KEY, JSON.stringify(receipts));
      } catch (err) {
        console.warn('LocalStorage save error:', err);
      }
    }
  }, [transactions, categories, bills, receipts, user, loading]);

  // Financial summary calculation
  const summary: FinancialSummary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((t) => {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
      }
    });

    const netBalance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) : 0;

    const todayStr = getTodayDateString();
    let pendingBillsCount = 0;
    let pendingBillsAmount = 0;
    let overdueBillsCount = 0;

    bills.forEach((b) => {
      if (b.status === 'unpaid') {
        pendingBillsCount += 1;
        pendingBillsAmount += b.amount;
        if (b.dueDate < todayStr) {
          overdueBillsCount += 1;
        }
      }
    });

    return {
      totalIncome,
      totalExpense,
      netBalance,
      savingsRate,
      pendingBillsCount,
      pendingBillsAmount,
      overdueBillsCount,
    };
  }, [transactions, bills]);

  // Transaction CRUD
  const addTransaction = async (data: Omit<Transaction, 'id' | 'userId' | 'createdAt'>): Promise<string> => {
    setIsSyncing(true);
    const receiptNumber = data.receiptNumber || generateReceiptNumber();
    const newTxn = cleanFirestoreData({
      ...data,
      receiptNumber,
      createdAt: new Date().toISOString(),
    });

    if (isCloudActive) {
      try {
        const ref = await addDoc(collection(db, 'transactions'), {
          ...newTxn,
          userId: currentUid,
        });
        setIsSyncing(false);
        return ref.id;
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.CREATE, 'transactions');
      }
    } else {
      const id = 'txn_' + Date.now();
      const completeTxn: Transaction = {
        ...newTxn,
        id,
        userId: 'guest',
      };
      setTransactions((prev) => [completeTxn, ...prev]);
      setIsSyncing(false);
      return id;
    }
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>): Promise<void> => {
    setIsSyncing(true);
    const updateData = cleanFirestoreData({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    if (isCloudActive) {
      try {
        const ref = doc(db, 'transactions', id);
        await updateDoc(ref, updateData);
        setIsSyncing(false);
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
      }
    } else {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updateData } : t))
      );
      setIsSyncing(false);
    }
  };

  const deleteTransaction = async (id: string): Promise<void> => {
    setIsSyncing(true);
    if (isCloudActive) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
        setIsSyncing(false);
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
      }
    } else {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setIsSyncing(false);
    }
  };

  // Category CRUD
  const addCategory = async (data: Omit<Category, 'id' | 'userId' | 'createdAt'>): Promise<string> => {
    if (isCloudActive) {
      try {
        const ref = await addDoc(collection(db, 'categories'), {
          ...data,
          userId: currentUid,
          createdAt: new Date().toISOString(),
        });
        return ref.id;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'categories');
      }
    } else {
      const id = 'cat_' + Date.now();
      const newCat: Category = {
        ...data,
        id,
        userId: 'guest',
        createdAt: new Date().toISOString(),
      };
      setCategories((prev) => [...prev, newCat]);
      return id;
    }
  };

  const updateCategory = async (id: string, data: Partial<Category>): Promise<void> => {
    if (isCloudActive) {
      try {
        await updateDoc(doc(db, 'categories', id), data);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `categories/${id}`);
      }
    } else {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data } : c))
      );
    }
  };

  const deleteCategory = async (id: string): Promise<void> => {
    if (isCloudActive) {
      try {
        await deleteDoc(doc(db, 'categories', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
      }
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
  };

  // Bill CRUD
  const addBill = async (data: Omit<Bill, 'id' | 'userId' | 'createdAt'>): Promise<string> => {
    const cleaned = cleanFirestoreData({
      ...data,
      userId: currentUid,
      createdAt: new Date().toISOString(),
    });
    if (isCloudActive) {
      try {
        const ref = await addDoc(collection(db, 'bills'), cleaned);
        return ref.id;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'bills');
      }
    } else {
      const id = 'bill_' + Date.now();
      const newBill: Bill = {
        ...cleaned,
        id,
        userId: 'guest',
        createdAt: new Date().toISOString(),
      };
      setBills((prev) => [...prev, newBill]);
      return id;
    }
  };

  const updateBill = async (id: string, data: Partial<Bill>): Promise<void> => {
    const cleaned = cleanFirestoreData({
      ...data,
      updatedAt: new Date().toISOString(),
    });
    if (isCloudActive) {
      try {
        await updateDoc(doc(db, 'bills', id), cleaned);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `bills/${id}`);
      }
    } else {
      setBills((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...cleaned } : b))
      );
    }
  };

  const deleteBill = async (id: string): Promise<void> => {
    if (isCloudActive) {
      try {
        await deleteDoc(doc(db, 'bills', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `bills/${id}`);
      }
    } else {
      setBills((prev) => prev.filter((b) => b.id !== id));
    }
  };

  const markBillAsPaid = async (billId: string, recordAsExpense: boolean = true): Promise<void> => {
    const targetBill = bills.find((b) => b.id === billId);
    if (!targetBill) return;

    const paidAt = new Date().toISOString();

    // 1. Mark bill as paid
    await updateBill(billId, {
      status: 'paid',
      paidAt,
    });

    // 2. Optionally record transaction as expense
    if (recordAsExpense) {
      await addTransaction({
        type: 'expense',
        amount: targetBill.amount,
        category: targetBill.category || 'Tagihan & Utilitas',
        description: `Pembayaran ${targetBill.title}`,
        date: getTodayDateString(),
        paymentMethod: 'Transfer BCA',
        receiptNumber: generateReceiptNumber(),
        note: `Tagihan otomatis diselesaikan pada ${new Date().toLocaleDateString('id-ID')}`,
      });
    }
  };

  // Bulk import transactions
  const importTransactions = async (newTxns: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[]): Promise<number> => {
    setIsSyncing(true);
    let count = 0;

    if (isCloudActive) {
      try {
        const batch = writeBatch(db);
        newTxns.forEach((txn) => {
          const ref = doc(collection(db, 'transactions'));
          batch.set(ref, {
            ...txn,
            receiptNumber: txn.receiptNumber || generateReceiptNumber(),
            userId: currentUid,
            createdAt: new Date().toISOString(),
          });
          count++;
        });
        await batch.commit();
        setIsSyncing(false);
        return count;
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.WRITE, 'transactions');
      }
    } else {
      const generated: Transaction[] = newTxns.map((txn, idx) => ({
        ...txn,
        id: `txn_imp_${Date.now()}_${idx}`,
        userId: 'guest',
        receiptNumber: txn.receiptNumber || generateReceiptNumber(),
        createdAt: new Date().toISOString(),
      }));
      setTransactions((prev) => [...generated, ...prev]);
      setIsSyncing(false);
      return generated.length;
    }
  };

  const restoreSampleData = async () => {
    const today = getTodayDateString();
    const demoTxns: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[] = [
      {
        type: 'income',
        amount: 22527500,
        category: 'Penjualan Ayam Gebrus',
        description: 'Penjualan Ayam Broiler 470 Ekor (Pak Ade #11)',
        date: today,
        paymentMethod: 'Transfer BCA Ayam Anugerah',
        receiptNumber: 'INV-AA-11',
        note: '860.9 kg @ 25.000 + 470 bj ati + 20 kg usus',
      },
      {
        type: 'income',
        amount: 1410300,
        category: 'Penjualan Ayam Gebrus',
        description: 'Penjualan Ayam Gebrus 30 Ekor (Moris #09)',
        date: today,
        paymentMethod: 'Tunai Kasir Gudang',
        receiptNumber: 'INV-AA-09',
        note: '50.6 kg @ 25.500, ati 30 bj, usus 5 kg',
      },
      {
        type: 'income',
        amount: 2686200,
        category: 'Penjualan Ayam Gebrus',
        description: 'Penjualan Ayam Gebrus 60 Ekor (Rio #12)',
        date: today,
        paymentMethod: 'Transfer BCA Ayam Anugerah',
        receiptNumber: 'INV-AA-12',
        note: '102.4 kg @ 25.500, ati 50 bj',
      },
      {
        type: 'expense',
        amount: 16500000,
        category: 'Beli Ayam Hidup Peternak',
        description: 'Pembelian Ayam Broiler Hidup Kandang Subang (800 Ekor)',
        date: today,
        paymentMethod: 'Transfer BCA Ayam Anugerah',
        receiptNumber: generateReceiptNumber(),
        note: 'Muatan truk pendingin masuk subuh',
      },
      {
        type: 'expense',
        amount: 600000,
        category: 'Operasional Pemotongan & Es',
        description: 'Pembelian Es Balok 30 Balok & Garam Pendingin',
        date: today,
        paymentMethod: 'Tunai Kasir Gudang',
        receiptNumber: generateReceiptNumber(),
        note: 'Untuk cold box & keranjang kirim karkas',
      },
      {
        type: 'expense',
        amount: 450000,
        category: 'BBM Solar Armada Kirim',
        description: 'BBM Solar Armada Truk Pick-up Pengiriman Karkas',
        date: today,
        paymentMethod: 'Tunai Kasir Gudang',
        receiptNumber: generateReceiptNumber(),
        note: 'Rute pengiriman restoran & lapak pasar',
      },
    ];

    for (const t of demoTxns) {
      await addTransaction(t);
    }
  };

  // Bulk delete selected transactions
  const deleteTransactionsBatch = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    setIsSyncing(true);

    if (isCloudActive) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => {
          batch.delete(doc(db, 'transactions', id));
        });
        await batch.commit();
        setIsSyncing(false);
        return ids.length;
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.DELETE, 'transactions');
      }
    } else {
      setTransactions((prev) => prev.filter((t) => !ids.includes(t.id)));
      setIsSyncing(false);
      return ids.length;
    }
  };

  // Delete transactions by date period (e.g. Month, custom range)
  const deleteTransactionsByPeriod = async (startDate: string, endDate: string): Promise<number> => {
    const toDelete = transactions.filter((t) => {
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });

    const ids = toDelete.map((t) => t.id);
    return await deleteTransactionsBatch(ids);
  };

  // Clear all financial records (Reset total rekap)
  const clearAllFinancialData = async (scope: 'all' | 'transactions_only' | 'bills_only' = 'all'): Promise<void> => {
    setIsSyncing(true);

    if (scope === 'all' || scope === 'transactions_only') {
      setTransactions([]);
      localStorage.setItem(LOCAL_STORAGE_TXN_KEY, JSON.stringify([]));
      localStorage.setItem('ayamanugrah_txns_cleared', 'true');
    }
    if (scope === 'all' || scope === 'bills_only') {
      setBills([]);
      localStorage.setItem(LOCAL_STORAGE_BILL_KEY, JSON.stringify([]));
      localStorage.setItem('ayamanugrah_bills_cleared', 'true');
    }

    if (isCloudActive) {
      try {
        if (scope === 'all' || scope === 'transactions_only') {
          const snapTxn = await getDocs(collection(db, 'transactions'));
          if (!snapTxn.empty) {
            const batch = writeBatch(db);
            snapTxn.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }

        if (scope === 'all' || scope === 'bills_only') {
          const snapBill = await getDocs(collection(db, 'bills'));
          if (!snapBill.empty) {
            const batch = writeBatch(db);
            snapBill.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }

        setIsSyncing(false);
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.DELETE, 'financial_data');
      }
    } else {
      setIsSyncing(false);
    }
  };

  // Receipts Operations (Ayam Anugerah Invoices)
  const addReceipt = async (data: AyamAnugrahReceipt): Promise<string> => {
    setIsSyncing(true);
    const receiptToSave = cleanFirestoreData({
      ...data,
      noteBox: data.noteBox ?? '',
      customerCode: data.customerCode ?? '',
      paymentType: data.paymentType ?? 'kredit',
      dueDate: data.dueDate ?? '09/11/2026',
      remainingDebt: data.remainingDebt !== undefined ? data.remainingDebt : (data.status === 'LUNAS' ? 0 : data.totalAmount),
      paidAmount: data.paidAmount !== undefined ? data.paidAmount : (data.status === 'LUNAS' ? data.totalAmount : 0),
      historyDate: data.historyDate ?? '02/11/2026',
      storeHeaderName: data.storeHeaderName ?? 'aa anugrah',
      storePhone: data.storePhone ?? '085735144958',
      storeHandle: data.storeHandle ?? '@@ anugrah',
      userId: currentUid,
      createdAt: data.createdAt || new Date().toISOString(),
    });

    localStorage.removeItem('ayamanugrah_receipts_cleared');
    if (isCloudActive) {
      try {
        const docRef = await addDoc(collection(db, 'receipts'), receiptToSave);
        setIsSyncing(false);
        return docRef.id;
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.CREATE, 'receipts');
        return '';
      }
    } else {
      setReceipts((prev) => [receiptToSave, ...prev]);
      setIsSyncing(false);
      return receiptToSave.id;
    }
  };

  const updateReceipt = async (id: string, data: Partial<AyamAnugrahReceipt>): Promise<void> => {
    setIsSyncing(true);
    const cleanedData = cleanFirestoreData(data);
    if (isCloudActive) {
      try {
        await updateDoc(doc(db, 'receipts', id), cleanedData);
        setIsSyncing(false);
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.UPDATE, `receipts/${id}`);
      }
    } else {
      setReceipts((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...cleanedData } : r))
      );
      setIsSyncing(false);
    }
  };

  const deleteReceipt = async (id: string): Promise<void> => {
    setIsSyncing(true);

    // 1. Optimistic removal from state immediately
    setReceipts((prev) => {
      const remaining = prev.filter(
        (r) =>
          r.id !== id &&
          (r as any).docId !== id &&
          (r as any).firestoreDocId !== id &&
          (r as any).originalId !== id &&
          r.receiptNumber !== id
      );
      if (remaining.length === 0) {
        localStorage.setItem('ayamanugrah_receipts_cleared', 'true');
      }
      return remaining;
    });

    // 2. Synchronize with localStorage
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_RECEIPT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const updated = parsed.filter(
          (r: any) =>
            r.id !== id &&
            r.docId !== id &&
            r.firestoreDocId !== id &&
            r.originalId !== id &&
            r.receiptNumber !== id
        );
        localStorage.setItem(LOCAL_STORAGE_RECEIPT_KEY, JSON.stringify(updated));
        if (updated.length === 0) {
          localStorage.setItem('ayamanugrah_receipts_cleared', 'true');
        }
      }
    } catch (e) {
      console.warn('LocalStorage delete receipt error:', e);
    }

    // 3. Delete from Cloud Firestore
    if (isCloudActive) {
      try {
        await deleteDoc(doc(db, 'receipts', id));
      } catch (err) {
        console.warn('Direct deleteDoc failed for id, running fallback query:', err);
      }

      // Fallback query in case the document had an internal id field matching id or receiptNumber
      try {
        const q1 = query(collection(db, 'receipts'), where('id', '==', id));
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
          const b = writeBatch(db);
          snap1.forEach((docItem) => b.delete(docItem.ref));
          await b.commit();
        }
      } catch {
        // ignore fallback errors
      }

      setIsSyncing(false);
    } else {
      setIsSyncing(false);
    }
  };

  const deleteReceiptsBatch = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    setIsSyncing(true);

    const idsSet = new Set(ids);
    setReceipts((prev) => {
      const remaining = prev.filter(
        (r) =>
          !idsSet.has(r.id) &&
          !idsSet.has((r as any).docId) &&
          !idsSet.has((r as any).firestoreDocId) &&
          !idsSet.has((r as any).originalId) &&
          !idsSet.has(r.receiptNumber)
      );
      if (remaining.length === 0) {
        localStorage.setItem('ayamanugrah_receipts_cleared', 'true');
      }
      return remaining;
    });

    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_RECEIPT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const updated = parsed.filter(
          (r: any) =>
            !idsSet.has(r.id) &&
            !idsSet.has(r.docId) &&
            !idsSet.has(r.firestoreDocId) &&
            !idsSet.has(r.originalId) &&
            !idsSet.has(r.receiptNumber)
        );
        localStorage.setItem(LOCAL_STORAGE_RECEIPT_KEY, JSON.stringify(updated));
        if (updated.length === 0) {
          localStorage.setItem('ayamanugrah_receipts_cleared', 'true');
        }
      }
    } catch (e) {
      console.warn('LocalStorage batch delete receipts error:', e);
    }

    if (isCloudActive) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => batch.delete(doc(db, 'receipts', id)));
        await batch.commit();
      } catch (error) {
        console.warn('Batch delete directly failed, fallback:', error);
      }
      setIsSyncing(false);
      return ids.length;
    } else {
      setIsSyncing(false);
      return ids.length;
    }
  };

  const clearReceipts = async (type: 'all' | 'belum_lunas' | 'lunas' = 'all'): Promise<number> => {
    setIsSyncing(true);

    if (type === 'all') {
      const count = receipts.length;
      setReceipts([]);
      localStorage.setItem('ayamanugrah_receipts_cleared', 'true');
      localStorage.setItem('ayamanugrah_receipts_initialized', 'true');
      localStorage.setItem(LOCAL_STORAGE_RECEIPT_KEY, JSON.stringify([]));

      if (isCloudActive) {
        try {
          const snap = await getDocs(collection(db, 'receipts'));
          if (!snap.empty) {
            const batch = writeBatch(db);
            snap.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        } catch (err) {
          console.warn('Firestore clear all receipts error:', err);
        }
      }
      setIsSyncing(false);
      return count;
    }

    const toDelete = receipts.filter((r) => {
      if (type === 'belum_lunas') return r.status === 'BELUM LUNAS';
      if (type === 'lunas') return r.status === 'LUNAS';
      return true;
    });
    return await deleteReceiptsBatch(toDelete.map((r) => r.id));
  };

  const restoreSampleReceipts = async (): Promise<void> => {
    setIsSyncing(true);
    localStorage.removeItem('ayamanugrah_receipts_cleared');
    localStorage.setItem('ayamanugrah_receipts_initialized', 'true');
    localStorage.setItem(LOCAL_STORAGE_RECEIPT_KEY, JSON.stringify(SAMPLE_AYAM_RECEIPTS));
    setReceipts(SAMPLE_AYAM_RECEIPTS);

    if (isCloudActive) {
      try {
        const snap = await getDocs(collection(db, 'receipts'));
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        SAMPLE_AYAM_RECEIPTS.forEach((r) => {
          const newRef = doc(collection(db, 'receipts'));
          batch.set(newRef, { ...r, userId: currentUid });
        });
        await batch.commit();
        setIsSyncing(false);
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.WRITE, 'receipts');
      }
    } else {
      setIsSyncing(false);
    }
  };

  const importReceipts = async (
    newReceipts: AyamAnugrahReceipt[],
    mode: 'replace' | 'append',
    syncToFinance: boolean = true
  ): Promise<number> => {
    setIsSyncing(true);

    // Unflag cleared state so receipts are preserved and displayed
    localStorage.removeItem('ayamanugrah_receipts_cleared');
    localStorage.setItem('ayamanugrah_receipts_initialized', 'true');

    const preparedReceipts: AyamAnugrahReceipt[] = newReceipts.map((r, i) => {
      const sanitized: AyamAnugrahReceipt = {
        id: r.id || `rcp_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
        userId: currentUid,
        receiptNumber: r.receiptNumber || `INV-AA-${String(i + 1).padStart(2, '0')}`,
        customerName: r.customerName || 'Pelanggan',
        customerCode: r.customerCode || '',
        noteBox: r.noteBox || '',
        date: r.date || getTodayDateString(),
        time: r.time || '00:57:55',
        totalAmount: Number(r.totalAmount) || 0,
        status: r.status || 'BELUM LUNAS',
        paymentType: r.paymentType || 'kredit',
        dueDate: r.dueDate || '09/11/2026',
        remainingDebt: r.remainingDebt !== undefined ? Number(r.remainingDebt) : (r.status === 'LUNAS' ? 0 : Number(r.totalAmount) || 0),
        paidAmount: r.paidAmount !== undefined ? Number(r.paidAmount) : (r.status === 'LUNAS' ? Number(r.totalAmount) || 0 : 0),
        historyDate: r.historyDate || '02/11/2026',
        storeHeaderName: r.storeHeaderName || 'aa anugrah',
        storePhone: r.storePhone || '085735144958',
        storeHandle: r.storeHandle || '@@ anugrah',
        items: (r.items || []).map((item) => ({
          name: item.name || 'Produk Ayam',
          detailLabel: item.detailLabel || '',
          quantity: Number(item.quantity) || 0,
          unit: item.unit || 'kg',
          price: Number(item.price) || 0,
          total: Number(item.total) || 0,
        })),
        createdAt: r.createdAt || new Date().toISOString(),
      };
      return sanitized;
    });

    // 1. Immediately update React state and LocalStorage for zero-lag UI feedback
    let nextReceipts: AyamAnugrahReceipt[] = [];
    if (mode === 'replace') {
      nextReceipts = preparedReceipts;
    } else {
      nextReceipts = [...preparedReceipts, ...receipts];
    }
    setReceipts(nextReceipts);
    try {
      localStorage.setItem(LOCAL_STORAGE_RECEIPT_KEY, JSON.stringify(nextReceipts));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // 2. Prepare financial sync records (Bills for unpaid receipts, Incomes for paid)
    const today = getTodayDateString();
    const newBills: Bill[] = [];
    const newTxns: Transaction[] = [];

    if (syncToFinance) {
      preparedReceipts.forEach((r) => {
        if (r.status === 'BELUM LUNAS') {
          newBills.push({
            id: 'bill_imp_' + Math.random().toString(36).substring(2, 9),
            userId: currentUid,
            title: `Tagihan Gudang - ${r.customerName} (${r.customerCode || '#--'})`,
            amount: r.totalAmount,
            category: 'Pelunasan Tagihan Gudang',
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
            repeatFrequency: 'once',
            status: 'unpaid',
            reminderDaysBefore: 1,
            notes: r.noteBox || `Struk ${r.receiptNumber}`,
            createdAt: new Date().toISOString(),
          });
        } else {
          newTxns.push({
            id: 'txn_imp_' + Math.random().toString(36).substring(2, 9),
            userId: currentUid,
            type: 'income',
            amount: r.totalAmount,
            category: 'Penjualan Ayam Gebrus',
            description: `Penjualan ${r.customerName} (${r.customerCode || '#--'})`,
            date: today,
            paymentMethod: 'Tunai Kasir Gudang',
            receiptNumber: r.receiptNumber,
            note: r.noteBox || '',
            createdAt: new Date().toISOString(),
          });
        }
      });

      if (newBills.length > 0) {
        setBills((prev) => [...newBills, ...prev]);
        try {
          const currentBills = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BILL_KEY) || '[]');
          localStorage.setItem(LOCAL_STORAGE_BILL_KEY, JSON.stringify([...newBills, ...currentBills]));
        } catch {}
      }
      if (newTxns.length > 0) {
        setTransactions((prev) => [...newTxns, ...prev]);
        try {
          const currentTxns = JSON.parse(localStorage.getItem(LOCAL_STORAGE_TXN_KEY) || '[]');
          localStorage.setItem(LOCAL_STORAGE_TXN_KEY, JSON.stringify([...newTxns, ...currentTxns]));
        } catch {}
      }
    }

    // 3. Persist to Cloud Firestore in chunked batches
    if (isCloudActive) {
      try {
        const operations: Array<{ type: 'set' | 'delete'; ref: any; data?: any }> = [];

        if (mode === 'replace') {
          const snap = await getDocs(collection(db, 'receipts'));
          snap.forEach((d) => {
            operations.push({ type: 'delete', ref: d.ref });
          });
        }

        preparedReceipts.forEach((r) => {
          const ref = doc(collection(db, 'receipts'));
          const firestoreObj = cleanFirestoreData({
            ...r,
            userId: currentUid,
          });
          operations.push({ type: 'set', ref, data: firestoreObj });
        });

        if (syncToFinance) {
          newBills.forEach((b) => {
            const billRef = doc(collection(db, 'bills'));
            operations.push({
              type: 'set',
              ref: billRef,
              data: cleanFirestoreData({ ...b, userId: currentUid }),
            });
          });

          newTxns.forEach((t) => {
            const txnRef = doc(collection(db, 'transactions'));
            operations.push({
              type: 'set',
              ref: txnRef,
              data: cleanFirestoreData({ ...t, userId: currentUid }),
            });
          });
        }

        // Commit in safe chunks of 250 operations to guarantee no batch size limit error
        const CHUNK_SIZE = 250;
        for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
          const chunk = operations.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          for (const op of chunk) {
            if (op.type === 'delete') {
              batch.delete(op.ref);
            } else if (op.type === 'set') {
              batch.set(op.ref, op.data);
            }
          }
          await batch.commit();
        }

        setIsSyncing(false);
        return preparedReceipts.length;
      } catch (error) {
        setIsSyncing(false);
        console.error('Firestore bulk import error:', error);
        handleFirestoreError(error, OperationType.WRITE, 'receipts');
        return preparedReceipts.length;
      }
    } else {
      setIsSyncing(false);
      return preparedReceipts.length;
    }
  };

  return (
    <FinanceContext.Provider
      value={{
        transactions,
        categories,
        bills,
        receipts,
        loading,
        isSyncing,
        lastSyncTime,
        summary,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addCategory,
        updateCategory,
        deleteCategory,
        addBill,
        updateBill,
        deleteBill,
        markBillAsPaid,
        importTransactions,
        restoreSampleData,
        deleteTransactionsBatch,
        deleteTransactionsByPeriod,
        clearAllFinancialData,
        addReceipt,
        updateReceipt,
        deleteReceipt,
        deleteReceiptsBatch,
        clearReceipts,
        restoreSampleReceipts,
        importReceipts,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};
