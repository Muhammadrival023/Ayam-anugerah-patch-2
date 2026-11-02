import { Category, Transaction, Bill, AyamAnugrahReceipt } from '../types/index';

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'userId' | 'createdAt'>[] = [
  // Pemasukan Ayam @ Anugerah
  { name: 'Penjualan Ayam Gebrus', type: 'income', icon: 'Store', color: '#10b981' },
  { name: 'Penjualan Ati Ampela', type: 'income', icon: 'PlusCircle', color: '#059669' },
  { name: 'Penjualan Usus Ayam', type: 'income', icon: 'ShoppingBag', color: '#0d9488' },
  { name: 'Pelunasan Tagihan Gudang', type: 'income', icon: 'Briefcase', color: '#6366f1' },
  { name: 'Penjualan Kepala & Ceker', type: 'income', icon: 'Sparkles', color: '#84cc16' },

  // Pengeluaran Operasional Gudang
  { name: 'Beli Ayam Hidup Peternak', type: 'expense', icon: 'Car', color: '#ef4444', budget: 25000000 },
  { name: 'Operasional Pemotongan & Es', type: 'expense', icon: 'Zap', color: '#f97316', budget: 4000000 },
  { name: 'BBM Solar Armada Kirim', type: 'expense', icon: 'Car', color: '#eab308', budget: 3500000 },
  { name: 'Listrik Cold Storage & Air', type: 'expense', icon: 'Zap', color: '#3b82f6', budget: 3000000 },
  { name: 'Gaji Karyawan Gudang RPA', type: 'expense', icon: 'Users', color: '#ec4899', budget: 12000000 },
];

export const POULTRY_PRODUCTS = [
  { name: 'Ayam Gebrus Broiler', defaultPrice: 25500 },
  { name: 'Ati Ampela Bersih (bj)', defaultPrice: 1500 },
  { name: 'Usus Segar Bersih (kg)', defaultPrice: 15000 },
  { name: 'Ceker Ayam Super (kg)', defaultPrice: 20000 },
  { name: 'Kepala Ayam (kg)', defaultPrice: 12000 },
  { name: 'Fillet Dada Boneless (kg)', defaultPrice: 52000 },
  { name: 'Paha Utuh (kg)', defaultPrice: 38000 },
];

export const PAYMENT_TERMS_OPTIONS = [
  'Cash / Tunai Saat Kirim',
  'Tempo 3 Hari',
  'Tempo 7 Hari (1 Minggu)',
  'Tempo 14 Hari (2 Minggu)',
  'Tempo 30 Hari (1 Bulan)',
];

export const PAYMENT_METHODS = [
  'Tunai Kasir Gudang',
  'Transfer BCA Ayam Anugerah',
  'Transfer Mandiri Usaha',
  'Transfer BRI Kas',
  'QRIS Gudang',
];

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCustomDateIndo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const month = months[d.getMonth()] || 'Nov';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

export function generateReceiptNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `AA-${dateStr}-${randomSuffix}`;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format numbers like Indonesian receipts: 1.290.300
export function formatAngkaIndo(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(amount);
}

// Authentic initial receipts matching the Google Sheet (DATA HARIAN GUDANG - AYAM @ ANUGRAH)
export const SAMPLE_AYAM_RECEIPTS: AyamAnugrahReceipt[] = [
  {
    id: 'rcp_mang_asep_01',
    userId: 'guest',
    receiptNumber: 'INV-AA-01',
    date: '01 Nov 2026',
    customerName: 'Mang Asep',
    customerCode: '#01',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(65 ekor)', quantity: 106.0, unit: 'kg', price: 24500, total: 2597000 },
      { name: 'Ati', quantity: 70, unit: 'bj', price: 1500, total: 105000 },
      { name: 'Usus', quantity: 3, unit: 'kg', price: 14000, total: 42000 },
    ],
    totalAmount: 2744000,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T05:00:00Z').toISOString(),
  },
  {
    id: 'rcp_iis_02',
    userId: 'guest',
    receiptNumber: 'INV-AA-02',
    date: '01 Nov 2026',
    customerName: 'Iis',
    customerCode: '#02',
    noteBox: 'Ket: Pita Hitam',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(58 ekor)', quantity: 98.5, unit: 'kg', price: 25500, total: 2511750 },
      { name: 'Ati', quantity: 50, unit: 'bj', price: 1500, total: 75000 },
    ],
    totalAmount: 2586750,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T05:15:00Z').toISOString(),
  },
  {
    id: 'rcp_firman_03',
    userId: 'guest',
    receiptNumber: 'INV-AA-03',
    date: '01 Nov 2026',
    customerName: 'Firman',
    customerCode: '#03',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(90 ekor)', quantity: 139.4, unit: 'kg', price: 25500, total: 3554700 },
      { name: 'Ati', quantity: 60, unit: 'bj', price: 1500, total: 90000 },
      { name: 'Usus', quantity: 5, unit: 'kg', price: 15000, total: 75000 },
    ],
    totalAmount: 3719700,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T05:30:00Z').toISOString(),
  },
  {
    id: 'rcp_dani_04',
    userId: 'guest',
    receiptNumber: 'INV-AA-04',
    date: '01 Nov 2026',
    customerName: 'Dani',
    customerCode: '#04',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(50 ekor)', quantity: 118.4, unit: 'kg', price: 25500, total: 3019200 },
      { name: 'Ati', quantity: 50, unit: 'bj', price: 1500, total: 75000 },
      { name: 'Usus', quantity: 5, unit: 'kg', price: 15000, total: 75000 },
    ],
    totalAmount: 3169200,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T05:45:00Z').toISOString(),
  },
  {
    id: 'rcp_dinar_05',
    userId: 'guest',
    receiptNumber: 'INV-AA-05',
    date: '01 Nov 2026',
    customerName: 'Dinar',
    customerCode: '#05',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(60 ekor)', quantity: 101.7, unit: 'kg', price: 25500, total: 2593350 },
      { name: 'Ati', quantity: 50, unit: 'bj', price: 1500, total: 75000 },
    ],
    totalAmount: 2668350,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T06:00:00Z').toISOString(),
  },
  {
    id: 'rcp_mang_agus_06',
    userId: 'guest',
    receiptNumber: 'INV-AA-06',
    date: '01 Nov 2026',
    customerName: 'Mang Agus',
    customerCode: '#06',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(15 ekor)', quantity: 30.6, unit: 'kg', price: 26000, total: 795600 },
      { name: 'Ati', quantity: 20, unit: 'bj', price: 1500, total: 30000 },
    ],
    totalAmount: 825600,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T06:15:00Z').toISOString(),
  },
  {
    id: 'rcp_pak_ade_07',
    userId: 'guest',
    receiptNumber: 'INV-AA-07',
    date: '01 Nov 2026',
    customerName: 'Pak Ade',
    customerCode: '#07',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(470 ekor)', quantity: 860.9, unit: 'kg', price: 25000, total: 21522500 },
      { name: 'Ati', quantity: 470, unit: 'bj', price: 1500, total: 705000 },
      { name: 'Usus', quantity: 20, unit: 'kg', price: 15000, total: 300000 },
    ],
    totalAmount: 22527500,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T06:30:00Z').toISOString(),
  },
  {
    id: 'rcp_ahmad_08',
    userId: 'guest',
    receiptNumber: 'INV-AA-08',
    date: '2026-11-02',
    time: '00:57:55',
    customerName: 'Ahmad',
    customerCode: '70 e',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '', quantity: 126.6, unit: 'kg', price: 24500, total: 3101700 },
      { name: 'Ati', quantity: 70, unit: 'bj', price: 1500, total: 105000 },
      { name: 'Usus', quantity: 5, unit: 'kg', price: 14000, total: 70000 },
    ],
    totalAmount: 3276700,
    status: 'BELUM LUNAS',
    paymentType: 'kredit',
    dueDate: '09/11/2026',
    remainingDebt: 3276700,
    paidAmount: 0,
    historyDate: '02/11/2026',
    storeHeaderName: 'aa anugrah',
    storePhone: '085735144958',
    storeHandle: '@@ anugrah',
    createdAt: new Date('2026-11-02T00:57:55Z').toISOString(),
  },
  {
    id: 'rcp_moris_09',
    userId: 'guest',
    receiptNumber: 'INV-AA-09',
    date: '01 Nov 2026',
    customerName: 'Moris',
    customerCode: '#09',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(30 ekor)', quantity: 50.6, unit: 'kg', price: 25500, total: 1290300 },
      { name: 'Ati', quantity: 30, unit: 'bj', price: 1500, total: 45000 },
      { name: 'Usus', quantity: 5, unit: 'kg', price: 15000, total: 75000 },
    ],
    totalAmount: 1410300,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T07:00:00Z').toISOString(),
  },
  {
    id: 'rcp_nanjung_10',
    userId: 'guest',
    receiptNumber: 'INV-AA-10',
    date: '01 Nov 2026',
    customerName: 'Nanjung',
    customerCode: '#10',
    noteBox: 'Ket: Pita Putih',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(40 ekor)', quantity: 69.5, unit: 'kg', price: 25500, total: 1772250 },
      { name: 'Ati', quantity: 80, unit: 'bj', price: 1500, total: 120000 },
      { name: 'Usus', quantity: 5, unit: 'kg', price: 15000, total: 75000 },
    ],
    totalAmount: 1967250,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T07:15:00Z').toISOString(),
  },
  {
    id: 'rcp_h_aang_11',
    userId: 'guest',
    receiptNumber: 'INV-AA-11',
    date: '01 Nov 2026',
    customerName: 'H. Aang',
    customerCode: '#11',
    noteBox: 'Ket: Pita Ungu',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(40 ekor)', quantity: 72.0, unit: 'kg', price: 25500, total: 1836000 },
      { name: 'Ati', quantity: 40, unit: 'bj', price: 1500, total: 60000 },
    ],
    totalAmount: 1896000,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T07:30:00Z').toISOString(),
  },
  {
    id: 'rcp_rio_12',
    userId: 'guest',
    receiptNumber: 'INV-AA-12',
    date: '01 Nov 2026',
    customerName: 'Rio',
    customerCode: '#12',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(60 ekor)', quantity: 102.4, unit: 'kg', price: 25500, total: 2611200 },
      { name: 'Ati', quantity: 50, unit: 'bj', price: 1500, total: 75000 },
    ],
    totalAmount: 2686200,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T07:45:00Z').toISOString(),
  },
  {
    id: 'rcp_s_13',
    userId: 'guest',
    receiptNumber: 'INV-AA-13',
    date: '01 Nov 2026',
    customerName: 'S',
    customerCode: '#13',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(15 ekor)', quantity: 30.6, unit: 'kg', price: 26000, total: 795600 },
      { name: 'Ati', quantity: 20, unit: 'bj', price: 1500, total: 30000 },
    ],
    totalAmount: 825600,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T08:00:00Z').toISOString(),
  },
  {
    id: 'rcp_saar_14',
    userId: 'guest',
    receiptNumber: 'INV-AA-14',
    date: '01 Nov 2026',
    customerName: 'Saar',
    customerCode: '#14',
    items: [
      { name: 'Ayam Gebrus', detailLabel: '(15 ekor)', quantity: 23.0, unit: 'kg', price: 25500, total: 586500 },
      { name: 'Ati', quantity: 20, unit: 'bj', price: 1500, total: 30000 },
    ],
    totalAmount: 616500,
    status: 'BELUM LUNAS',
    createdAt: new Date('2026-11-01T08:15:00Z').toISOString(),
  },
];
