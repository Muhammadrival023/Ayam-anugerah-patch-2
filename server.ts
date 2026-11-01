import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Shared Gemini client with required User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API Route: AI Excel / Raw Text Reader & Parser
app.post('/api/ai/parse-excel', async (req: Request, res: Response) => {
  try {
    const { rawContent, context } = req.body;

    if (!rawContent || typeof rawContent !== 'string') {
      return res.status(400).json({ error: 'Konten data Excel / teks wajib diisi.' });
    }

    const systemInstruction = `
Anda adalah asisten data entry & akuntan profesional untuk bisnis distribusi ayam potong & karkas bernama "Ayam Anugerah".
Tugas Anda adalah membaca data tagihan yang di-paste dari Excel, CSV, catatan pesan WhatsApp, atau teks nota yang berantakan, lalu mengekstraknya menjadi data tabel tagihan yang rapi dan terstruktur.

Aturan parsing:
1. Ekstrak setiap baris menjadi:
   - customerName: Nama pembeli/mitra (contoh: "Resto Padang Sederhana", "Warung Pecel Lele Mas Joko", "Catering Berkah", "Pak Haji Slamet")
   - productName: Jenis ayam / produk (contoh: "Ayam Broiler Utuh", "Fillet Dada", "Paha Utuh", "Sayap", "Ati Ampela", "Boneless Dada", "Karkas Segar")
   - weightKg: Bobot total dalam kilogram (angka desimal). Jika hanya ada jumlah ekor tanpa kg, estimasikan 1 ekor = ~1.2 kg atau set sesuai data.
   - pricePerKg: Harga per kg (angka integer dalam Rupiah, contoh: 35000)
   - totalAmount: Total tagihan (weightKg * pricePerKg atau dari data yang ada)
   - dueDate: Tanggal jatuh tempo format YYYY-MM-DD. Jika tidak tertera, set 7 hari ke depan dari hari ini.
   - paymentTerms: "Cash", "Tempo 3 Hari", "Tempo 7 Hari", "Tempo 14 Hari", atau "Tempo 30 Hari".
   - notes: Catatan spesifik (misal: "Ukuran 1.0 - 1.2 kg", "Kirim subuh jam 04:00", dsb).

Keluarkan hasil murni JSON array tanpa markdown tambahan.
`;

    const prompt = `
Berikut adalah data mentah tagihan dari Excel/pesan/nota:
---
${rawContent}
---
${context ? `Konteks tambahan: ${context}` : ''}

Ekstrak dan standarisasi semua item tagihan ke format JSON.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              customerName: { type: Type.STRING },
              productName: { type: Type.STRING },
              weightKg: { type: Type.NUMBER },
              pricePerKg: { type: Type.NUMBER },
              totalAmount: { type: Type.NUMBER },
              dueDate: { type: Type.STRING },
              paymentTerms: { type: Type.STRING },
              notes: { type: Type.STRING },
            },
            required: ['customerName', 'productName', 'weightKg', 'pricePerKg', 'totalAmount'],
          },
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '[]');
    return res.json({ success: true, data: parsedJson });
  } catch (error: any) {
    console.error('AI Parse Excel Error:', error);
    return res.status(500).json({
      error: error.message || 'Gagal memproses data tagihan dengan AI.',
    });
  }
});

// API Route: AI Cash Flow & Accounts Receivable Analysis
app.post('/api/ai/analyze-cashflow', async (req: Request, res: Response) => {
  try {
    const { bills, transactions, summary } = req.body;

    const systemInstruction = `
Anda adalah konsultan keuangan senior dan analis bisnis khusus industri peternakan dan distribusi ayam potong ("Ayam Anugerah").
Analisa kondisi arus kas, piutang pelanggan, hutang supplier, dan kepatuhan pembayaran tempo.

Berikan analisis dalam format JSON dengan struktur:
1. healthScore: Angka skor kesehatan keuangan 1-100
2. healthStatus: 'Sangat Sehat' | 'Stabil' | 'Perlu Waspada' | 'Kritis'
3. summaryAnalysis: Ringkasan eksekutif 2-3 kalimat mengenai kondisi arus kas bisnis Ayam Anugerah.
4. receivablesRisk: Evaluasi piutang macet / pelanggan yang tempo pembayarannya berisiko.
5. cashFlowForecast: Prediksi arus kas 7-14 hari ke depan berdasarkan tagihan tempo masuk vs pengeluaran operasional (pakan/livebird/solar).
6. actionRecommendations: Array berisi 3-4 rekomendasi aksi konkret yang harus segera dilakukan oleh pemilik usaha Ayam Anugerah.
`;

    const prompt = `
Data Bisnis Ayam Anugerah saat ini:
- Ringkasan Arus Kas: ${JSON.stringify(summary || {})}
- Daftar Tagihan / Piutang Pelanggan: ${JSON.stringify((bills || []).slice(0, 30))}
- Transaksi Arus Kas Terakhir: ${JSON.stringify((transactions || []).slice(0, 30))}

Lakukan analisis mendalam terhadap kesehatan arus kas dan penagihan piutang ayam.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            healthScore: { type: Type.INTEGER },
            healthStatus: { type: Type.STRING },
            summaryAnalysis: { type: Type.STRING },
            receivablesRisk: { type: Type.STRING },
            cashFlowForecast: { type: Type.STRING },
            actionRecommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'healthScore',
            'healthStatus',
            'summaryAnalysis',
            'receivablesRisk',
            'cashFlowForecast',
            'actionRecommendations',
          ],
        },
      },
    });

    const analysis = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: analysis });
  } catch (error: any) {
    console.error('AI Cashflow Analysis Error:', error);
    return res.status(500).json({
      error: error.message || 'Gagal melakukan analisis AI.',
    });
  }
});

// API Route: AI Smart WhatsApp Reminder Generator
app.post('/api/ai/generate-reminder', async (req: Request, res: Response) => {
  try {
    const { bill, tone = 'polite' } = req.body;

    const systemInstruction = `
Anda adalah asisten admin penagihan untuk "Ayam Anugerah" (Supplier Ayam Potong Berkualitas).
Buatkan draf pesan WhatsApp penagihan tagihan pengiriman ayam ke pelanggan.
Pilihan tone:
- 'polite': Ramah, sopan, mengingatkan jatuh tempo yang sebentar lagi atau hari ini.
- 'firm': Tegas, profesional, untuk tagihan yang sudah lewat jatuh tempo beberapa hari.
- 'urgent': Mendesak & peringatan penghentian pengiriman pesanan ayam berikutnya jika belum ada pembayaran/konfirmasi.

Pesan harus mencantumkan:
- Salam hormat
- Nama Mitra/Pelanggan
- Rincian Pesanan Ayam (Jumlah / Total Nominal)
- Tanggal Jatuh Tempo & Nomor Rekening Transfer Bank (BCA / Mandiri / BRI Ayam Anugerah)
- Permohonan bukti transfer jika sudah dibayarkan.
Gunakan format teks WhatsApp dengan tanda bintang (*) untuk cetak tebal dan emotikon yang wajar.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Buatkan pesan WhatsApp untuk tagihan ini dengan gaya '${tone}':\n${JSON.stringify(bill)}`,
      config: {
        systemInstruction,
      },
    });

    return res.json({ success: true, message: response.text });
  } catch (error: any) {
    console.error('AI Reminder Generator Error:', error);
    return res.status(500).json({
      error: error.message || 'Gagal menghasilkan pesan pengingat tagihan.',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server Ayam Anugerah berjalan di http://localhost:${PORT}`);
  });
}

startServer();
