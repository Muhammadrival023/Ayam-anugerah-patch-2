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

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();

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

    if (user) {
      // Authenticated with Google Firebase -> Realtime listeners
      setIsSyncing(true);

      const txnPath = 'transactions';
      const catPath = 'categories';
      const billPath = 'bills';
      const receiptPath = 'receipts';

      const qTxn = query(collection(db, txnPath), where('userId', '==', user.uid));
      const qCat = query(collection(db, catPath), where('userId', '==', user.uid));
      const qBill = query(collection(db, billPath), where('userId', '==', user.uid));
      const qReceipt = query(collection(db, receiptPath), where('userId', '==', user.uid));

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
                  userId: user.uid,
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
          if (snapshot.empty) {
            try {
              const batch = writeBatch(db);
              SAMPLE_AYAM_RECEIPTS.forEach((r) => {
                const newReceiptRef = doc(collection(db, 'receipts'));
                batch.set(newReceiptRef, {
                  ...r,
                  userId: user.uid,
                });
              });
              await batch.commit();
            } catch (err) {
              console.warn('Seeding default receipts error:', err);
            }
          } else {
            const list: AyamAnugrahReceipt[] = [];
            snapshot.forEach((d) => {
              list.push({ id: d.id, ...d.data() } as AyamAnugrahReceipt);
            });
            list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setReceipts(list);
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

        if (savedReceipts) {
          try {
            setReceipts(JSON.parse(savedReceipts));
          } catch {
            setReceipts(SAMPLE_AYAM_RECEIPTS);
          }
        } else {
          setReceipts(SAMPLE_AYAM_RECEIPTS);
          localStorage.setItem(LOCAL_STORAGE_RECEIPT_KEY, JSON.stringify(SAMPLE_AYAM_RECEIPTS));
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
    const newTxn = {
      ...data,
      receiptNumber,
      createdAt: new Date().toISOString(),
    };

    if (user) {
      try {
        const ref = await addDoc(collection(db, 'transactions'), {
          ...newTxn,
          userId: user.uid,
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
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    if (user) {
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
    if (user) {
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
    if (user) {
      try {
        const ref = await addDoc(collection(db, 'categories'), {
          ...data,
          userId: user.uid,
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
    if (user) {
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
    if (user) {
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
    if (user) {
      try {
        const ref = await addDoc(collection(db, 'bills'), {
          ...data,
          userId: user.uid,
          createdAt: new Date().toISOString(),
        });
        return ref.id;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'bills');
      }
    } else {
      const id = 'bill_' + Date.now();
      const newBill: Bill = {
        ...data,
        id,
        userId: 'guest',
        createdAt: new Date().toISOString(),
      };
      setBills((prev) => [...prev, newBill]);
      return id;
    }
  };

  const updateBill = async (id: string, data: Partial<Bill>): Promise<void> => {
    if (user) {
      try {
        await updateDoc(doc(db, 'bills', id), {
          ...data,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `bills/${id}`);
      }
    } else {
      setBills((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...data, updatedAt: new Date().toISOString() } : b))
      );
    }
  };

  const deleteBill = async (id: string): Promise<void> => {
    if (user) {
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

    if (user) {
      try {
        const batch = writeBatch(db);
        newTxns.forEach((txn) => {
          const ref = doc(collection(db, 'transactions'));
          batch.set(ref, {
            ...txn,
            receiptNumber: txn.receiptNumber || generateReceiptNumber(),
            userId: user.uid,
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

    if (user) {
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

    if (user) {
      try {
        const batch = writeBatch(db);

        if (scope === 'all' || scope === 'transactions_only') {
          transactions.forEach((t) => {
            batch.delete(doc(db, 'transactions', t.id));
          });
        }

        if (scope === 'all' || scope === 'bills_only') {
          bills.forEach((b) => {
            batch.delete(doc(db, 'bills', b.id));
          });
        }

        await batch.commit();
        setIsSyncing(false);
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.DELETE, 'financial_data');
      }
    } else {
      if (scope === 'all' || scope === 'transactions_only') {
        setTransactions([]);
        localStorage.removeItem(LOCAL_STORAGE_TXN_KEY);
      }
      if (scope === 'all' || scope === 'bills_only') {
        setBills([]);
        localStorage.removeItem(LOCAL_STORAGE_BILL_KEY);
      }
      setIsSyncing(false);
    }
  };

  // Receipts Operations (Ayam Anugerah Invoices)
  const addReceipt = async (data: AyamAnugrahReceipt): Promise<string> => {
    setIsSyncing(true);
    const receiptToSave = {
      ...data,
      userId: user ? user.uid : 'guest',
      createdAt: data.createdAt || new Date().toISOString(),
    };

    if (user) {
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
    if (user) {
      try {
        await updateDoc(doc(db, 'receipts', id), data);
        setIsSyncing(false);
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.UPDATE, 'receipts');
      }
    } else {
      setReceipts((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data } : r))
      );
      setIsSyncing(false);
    }
  };

  const deleteReceipt = async (id: string): Promise<void> => {
    setIsSyncing(true);
    if (user) {
      try {
        await deleteDoc(doc(db, 'receipts', id));
        setIsSyncing(false);
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.DELETE, 'receipts');
      }
    } else {
      setReceipts((prev) => prev.filter((r) => r.id !== id));
      setIsSyncing(false);
    }
  };

  const deleteReceiptsBatch = async (ids: string[]): Promise<number> => {
    setIsSyncing(true);
    if (user) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => batch.delete(doc(db, 'receipts', id)));
        await batch.commit();
        setIsSyncing(false);
        return ids.length;
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.DELETE, 'receipts');
        return 0;
      }
    } else {
      setReceipts((prev) => prev.filter((r) => !ids.includes(r.id)));
      setIsSyncing(false);
      return ids.length;
    }
  };

  const clearReceipts = async (type: 'all' | 'belum_lunas' | 'lunas' = 'all'): Promise<number> => {
    const toDelete = receipts.filter((r) => {
      if (type === 'belum_lunas') return r.status === 'BELUM LUNAS';
      if (type === 'lunas') return r.status === 'LUNAS';
      return true;
    });
    return await deleteReceiptsBatch(toDelete.map((r) => r.id));
  };

  const restoreSampleReceipts = async (): Promise<void> => {
    setIsSyncing(true);
    if (user) {
      try {
        const batch = writeBatch(db);
        receipts.forEach((r) => batch.delete(doc(db, 'receipts', r.id)));
        SAMPLE_AYAM_RECEIPTS.forEach((r) => {
          const newRef = doc(collection(db, 'receipts'));
          batch.set(newRef, { ...r, userId: user.uid });
        });
        await batch.commit();
        setIsSyncing(false);
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.WRITE, 'receipts');
      }
    } else {
      setReceipts(SAMPLE_AYAM_RECEIPTS);
      localStorage.setItem(LOCAL_STORAGE_RECEIPT_KEY, JSON.stringify(SAMPLE_AYAM_RECEIPTS));
      setIsSyncing(false);
    }
  };

  const importReceipts = async (
    newReceipts: AyamAnugrahReceipt[],
    mode: 'replace' | 'append',
    syncToFinance: boolean = true
  ): Promise<number> => {
    setIsSyncing(true);
    const preparedReceipts = newReceipts.map((r, i) => ({
      ...r,
      id: r.id || `rcp_${Date.now()}_${i}`,
      userId: user ? user.uid : 'guest',
      createdAt: r.createdAt || new Date().toISOString(),
    }));

    if (user) {
      try {
        const batch = writeBatch(db);
        if (mode === 'replace') {
          receipts.forEach((r) => batch.delete(doc(db, 'receipts', r.id)));
        }
        preparedReceipts.forEach((r) => {
          const ref = doc(collection(db, 'receipts'));
          batch.set(ref, r);
        });

        if (syncToFinance) {
          const today = getTodayDateString();
          preparedReceipts.forEach((r) => {
            if (r.status === 'BELUM LUNAS') {
              const billRef = doc(collection(db, 'bills'));
              batch.set(billRef, {
                userId: user.uid,
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
            } else if (r.status === 'LUNAS') {
              const txnRef = doc(collection(db, 'transactions'));
              batch.set(txnRef, {
                userId: user.uid,
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
        }

        await batch.commit();
        setIsSyncing(false);
        return preparedReceipts.length;
      } catch (error) {
        setIsSyncing(false);
        handleFirestoreError(error, OperationType.WRITE, 'receipts');
        return 0;
      }
    } else {
      if (mode === 'replace') {
        setReceipts(preparedReceipts);
      } else {
        setReceipts((prev) => [...preparedReceipts, ...prev]);
      }

      if (syncToFinance) {
        const today = getTodayDateString();
        const newBills: Bill[] = [];
        const newTxns: Transaction[] = [];

        preparedReceipts.forEach((r) => {
          if (r.status === 'BELUM LUNAS') {
            newBills.push({
              id: 'bill_imp_' + Math.random().toString(36).substr(2, 9),
              userId: 'guest',
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
              id: 'txn_imp_' + Math.random().toString(36).substr(2, 9),
              userId: 'guest',
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

        if (newBills.length > 0) setBills((prev) => [...newBills, ...prev]);
        if (newTxns.length > 0) setTransactions((prev) => [...newTxns, ...prev]);
      }

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
