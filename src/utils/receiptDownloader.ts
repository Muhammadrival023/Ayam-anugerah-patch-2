import { AyamAnugrahReceipt } from '../types/index';
import { formatAngkaIndo, formatRupiah } from '../data/defaults';

/**
 * Triggers browser download for any Blob with a given filename
 */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Clean sanitization for filenames
 */
export const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
};

/**
 * Formats a single receipt into monospace text (suitable for POS thermal printer or TXT archive)
 */
export const formatReceiptAsText = (receipt: AyamAnugrahReceipt): string => {
  const sep = '------------------------------------------------';
  const width = 48;

  const center = (str: string) => {
    const pad = Math.max(0, Math.floor((width - str.length) / 2));
    return ' '.repeat(pad) + str;
  };

  const lineBetween = (left: string, right: string) => {
    const spaces = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(spaces) + right;
  };

  const lines: string[] = [
    center('AYAM @ ANUGRAH'),
    center('DATA HARIAN GUDANG'),
    center('STRUK TAGIHAN / INVOICE'),
    sep,
    `Tanggal   : ${receipt.date}`,
    `Pelanggan : ${receipt.customerName} (${receipt.customerCode || '#--'})`,
  ];

  if (receipt.noteBox) {
    lines.push(`Ket: [ ${receipt.noteBox} ]`);
  }

  lines.push(sep);

  receipt.items.forEach((item) => {
    const itemTitle = `${item.name} ${item.detailLabel || ''}`.trim();
    lines.push(itemTitle);
    const subLeft = `  ${item.quantity} ${item.unit} x ${formatAngkaIndo(item.price)}`;
    const subRight = `Rp ${formatAngkaIndo(item.total)}`;
    lines.push(lineBetween(subLeft, subRight));
  });

  lines.push(sep);
  lines.push(lineBetween('TOTAL TAGIHAN', `Rp ${formatAngkaIndo(receipt.totalAmount)}`));
  lines.push(`Status Pembayaran [ ${receipt.status} ]`);
  lines.push(sep);
  lines.push(center('Mohon segera melakukan pembayaran.'));
  lines.push(center('Terima Kasih Atas Kerjasamanya.'));
  lines.push('');

  return lines.join('\n');
};

/**
 * Downloads a single receipt as formatted .TXT file
 */
export const downloadReceiptAsTxt = (receipt: AyamAnugrahReceipt) => {
  const content = formatReceiptAsText(receipt);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const filename = `Struk_${sanitizeFilename(receipt.customerName)}_${sanitizeFilename(receipt.customerCode || 'Nota')}_${sanitizeFilename(receipt.date)}.txt`;
  downloadBlob(blob, filename);
};

/**
 * Downloads all visible receipts combined into a single .TXT log
 */
export const downloadAllReceiptsAsTxt = (receipts: AyamAnugrahReceipt[]) => {
  const banner = [
    '================================================',
    '        AYAM @ ANUGRAH - REKAP STRUK GUDANG      ',
    `        Dicetak Pada: ${new Date().toLocaleString('id-ID')}       `,
    `        Total ${receipts.length} Struk Tersimpan `,
    '================================================\n',
  ].join('\n');

  const combined = banner + receipts.map((r, i) => `[STRUK #${i + 1}]\n` + formatReceiptAsText(r)).join('\n\n' + '='.repeat(48) + '\n\n');
  const blob = new Blob([combined], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `Rekap_Semua_Struk_Ayam_Anugerah_${sanitizeFilename(new Date().toLocaleDateString('id-ID'))}.txt`);
};

/**
 * Downloads single receipt breakdown as CSV (Excel compatible)
 */
export const downloadReceiptAsCsv = (receipt: AyamAnugrahReceipt) => {
  const rows: string[][] = [
    ['AYAM @ ANUGRAH - STRUK TAGIHAN'],
    ['Tanggal', receipt.date],
    ['Pelanggan', receipt.customerName],
    ['Kode', receipt.customerCode || ''],
    ['Keterangan', receipt.noteBox || '-'],
    ['Status Pembayaran', receipt.status],
    [],
    ['No', 'Nama Barang', 'Detail', 'Jumlah', 'Satuan', 'Harga Satuan (Rp)', 'Total (Rp)'],
  ];

  receipt.items.forEach((it, idx) => {
    rows.push([
      String(idx + 1),
      it.name,
      it.detailLabel || '',
      String(it.quantity),
      it.unit,
      String(it.price),
      String(it.total),
    ]);
  });

  rows.push([]);
  rows.push(['', '', '', '', '', 'TOTAL TAGIHAN', String(receipt.totalAmount)]);

  const csvContent = '\uFEFF' + rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `Data_Tagihan_${sanitizeFilename(receipt.customerName)}_${sanitizeFilename(receipt.customerCode || '')}.csv`;
  downloadBlob(blob, filename);
};

/**
 * Downloads all receipts as consolidated CSV for Excel
 */
export const downloadAllReceiptsAsCsv = (receipts: AyamAnugrahReceipt[]) => {
  const headers = [
    'No Struk / Urut',
    'Tanggal',
    'Nama Pelanggan',
    'Kode',
    'Catatan / Box',
    'Nama Produk',
    'Detail Ekor',
    'Qty',
    'Satuan',
    'Harga (Rp)',
    'Subtotal Item (Rp)',
    'Total Struk (Rp)',
    'Status Pembayaran',
  ];

  const rows: string[][] = [headers];

  receipts.forEach((r, rIdx) => {
    r.items.forEach((it, iIdx) => {
      rows.push([
        r.customerCode || `#${rIdx + 1}`,
        r.date,
        r.customerName,
        r.customerCode || '',
        r.noteBox || '',
        it.name,
        it.detailLabel || '',
        String(it.quantity),
        it.unit,
        String(it.price),
        String(it.total),
        iIdx === 0 ? String(r.totalAmount) : '',
        r.status,
      ]);
    });
  });

  const csvContent = '\uFEFF' + rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `Rekap_Excel_Semua_Struk_Ayam_${sanitizeFilename(new Date().toLocaleDateString('id-ID'))}.csv`);
};

/**
 * Generates an ultra crisp, authentic thermal receipt PNG image using HTML5 Canvas
 * Exactly mirrors the physical receipt screenshot layout
 */
export const downloadReceiptAsPng = async (receipt: AyamAnugrahReceipt): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Scale factor for Retina / high-DPI crystal-clear output
      const scale = 2;
      const baseWidth = 440;

      // Calculate required height dynamically
      let estimatedHeight = 360;
      if (receipt.noteBox) estimatedHeight += 40;
      estimatedHeight += receipt.items.length * 48;

      const canvas = document.createElement('canvas');
      canvas.width = baseWidth * scale;
      canvas.height = estimatedHeight * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
      }

      ctx.scale(scale, scale);

      // 1. Background (Clean white POS paper look with faint shadow border)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, baseWidth, estimatedHeight);

      // Outer paper border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, baseWidth - 2, estimatedHeight - 2);

      let y = 30;

      // Header: AYAM @ ANUGRAH
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 18px "Courier New", Courier, monospace';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '1px';
      ctx.fillText('AYAM @ ANUGRAH', baseWidth / 2, y);

      y += 20;
      ctx.font = '12px "Courier New", Courier, monospace';
      ctx.fillStyle = '#374151';
      ctx.fillText('DATA HARIAN GUDANG', baseWidth / 2, y);

      y += 18;
      ctx.font = 'bold 13px "Courier New", Courier, monospace';
      ctx.fillStyle = '#111827';
      ctx.fillText('STRUK TAGIHAN / INVOICE', baseWidth / 2, y);

      // Dashed line helper
      const drawDashedLine = (lineY: number, isSolid = false) => {
        ctx.save();
        ctx.beginPath();
        if (isSolid) {
          ctx.setLineDash([]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#111827';
        } else {
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#6b7280';
        }
        ctx.moveTo(24, lineY);
        ctx.lineTo(baseWidth - 24, lineY);
        ctx.stroke();
        ctx.restore();
      };

      y += 14;
      drawDashedLine(y);

      // Date & Customer Info
      y += 22;
      ctx.textAlign = 'left';
      ctx.font = '13px "Courier New", Courier, monospace';
      ctx.fillStyle = '#1f2937';
      ctx.fillText(`Tanggal   : ${receipt.date}`, 24, y);

      y += 20;
      ctx.font = 'bold 13px "Courier New", Courier, monospace';
      ctx.fillText(`Pelanggan : ${receipt.customerName} (${receipt.customerCode || '#--'})`, 24, y);

      // Note Box if present (e.g. Ket: Pita Putih)
      if (receipt.noteBox) {
        y += 12;
        const boxText = receipt.noteBox;
        ctx.font = 'bold 12px "Courier New", Courier, monospace';
        const textWidth = ctx.measureText(boxText).width;
        const boxPadX = 8;
        const boxPadY = 4;

        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(24, y, textWidth + boxPadX * 2, 20);

        ctx.fillStyle = '#111827';
        ctx.fillText(boxText, 24 + boxPadX, y + 14);
        y += 24;
      }

      y += 10;
      drawDashedLine(y);

      // Items list
      y += 12;
      receipt.items.forEach((item) => {
        y += 14;
        ctx.font = 'bold 13px "Courier New", Courier, monospace';
        ctx.fillStyle = '#111827';
        ctx.textAlign = 'left';
        ctx.fillText(`${item.name} ${item.detailLabel || ''}`.trim(), 24, y);

        y += 18;
        ctx.font = '12px "Courier New", Courier, monospace';
        ctx.fillStyle = '#374151';
        ctx.textAlign = 'left';
        ctx.fillText(`  ${item.quantity} ${item.unit} x ${formatAngkaIndo(item.price)}`, 24, y);

        ctx.font = 'bold 13px "Courier New", Courier, monospace';
        ctx.fillStyle = '#111827';
        ctx.textAlign = 'right';
        ctx.fillText(`Rp ${formatAngkaIndo(item.total)}`, baseWidth - 24, y);
      });

      y += 14;
      drawDashedLine(y, true); // Solid separator for total

      // Total
      y += 22;
      ctx.font = 'bold 15px "Courier New", Courier, monospace';
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'left';
      ctx.fillText('TOTAL TAGIHAN', 24, y);

      ctx.textAlign = 'right';
      ctx.font = 'bold 16px "Courier New", Courier, monospace';
      ctx.fillText(`Rp ${formatAngkaIndo(receipt.totalAmount)}`, baseWidth - 24, y);

      // Payment Status
      y += 24;
      ctx.textAlign = 'left';
      ctx.font = '12px "Courier New", Courier, monospace';
      ctx.fillStyle = '#4b5563';
      ctx.fillText('Status Pembayaran', 24, y);

      const isLunas = receipt.status === 'LUNAS';
      ctx.textAlign = 'right';
      ctx.font = 'bold 13px "Courier New", Courier, monospace';
      ctx.fillStyle = isLunas ? '#047857' : '#b91c1c';
      ctx.fillText(`[ ${receipt.status} ]`, baseWidth - 24, y);

      y += 14;
      drawDashedLine(y);

      // Footer
      y += 20;
      ctx.textAlign = 'center';
      ctx.font = '11px "Courier New", Courier, monospace';
      ctx.fillStyle = '#4b5563';
      ctx.fillText('Mohon segera melakukan pembayaran.', baseWidth / 2, y);

      y += 16;
      ctx.fillText('Terima Kasih Atas Kerjasamanya.', baseWidth / 2, y);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Gagal membuat gambar struk'));
          return;
        }
        const filename = `Struk_Ayam_${sanitizeFilename(receipt.customerName)}_${sanitizeFilename(receipt.customerCode || '')}_${sanitizeFilename(receipt.date)}.png`;
        downloadBlob(blob, filename);
        resolve();
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
};

/* ==========================================================================
   GOOGLE SHEETS EXCEL & CSV EXPORT (DATA HARIAN GUDANG - AYAM @ ANUGRAH)
   Matches exact layout, formulas, grouped columns & summary of the Google Sheet
   ========================================================================== */

import * as XLSX from 'xlsx';

export interface WarehouseSheetRow {
  no: number;
  customerName: string;
  ekor: number;
  ayamKg: number;
  ayamPrice: number;
  ayamTotal: number;
  atiBiji: number;
  atiPrice: number;
  atiTotal: number;
  ususKg: number;
  ususPrice: number;
  ususTotal: number;
  grandTotal: number;
  keterangan: string;
}

/**
 * Extracts warehouse table columns from a receipt
 */
export const parseReceiptToWarehouseRow = (receipt: AyamAnugrahReceipt, index: number): WarehouseSheetRow => {
  let ekor = 0;
  let ayamKg = 0;
  let ayamPrice = 0;
  let ayamTotal = 0;

  let atiBiji = 0;
  let atiPrice = 0;
  let atiTotal = 0;

  let ususKg = 0;
  let ususPrice = 0;
  let ususTotal = 0;

  receipt.items.forEach((item) => {
    const nameLower = (item.name || '').toLowerCase();

    // Check Ayam Gebrus
    if (nameLower.includes('ayam') || nameLower.includes('gebrus') || nameLower.includes('broiler')) {
      ayamKg += item.quantity || 0;
      if (item.price) ayamPrice = item.price;
      ayamTotal += item.total || 0;

      if (item.detailLabel) {
        const match = item.detailLabel.match(/(\d+)\s*ekor/i);
        if (match) {
          ekor += parseInt(match[1], 10);
        }
      }
    } else if (nameLower.includes('ati') || nameLower.includes('ampela')) {
      atiBiji += item.quantity || 0;
      if (item.price) atiPrice = item.price;
      atiTotal += item.total || 0;
    } else if (nameLower.includes('usus')) {
      ususKg += item.quantity || 0;
      if (item.price) ususPrice = item.price;
      ususTotal += item.total || 0;
    } else {
      if (item.unit === 'ekor') {
        ekor += item.quantity || 0;
      }
    }
  });

  if (ekor === 0 && receipt.noteBox) {
    const match = receipt.noteBox.match(/(\d+)\s*ekor/i);
    if (match) {
      ekor = parseInt(match[1], 10);
    }
  }

  let keterangan = receipt.noteBox || '';
  if (keterangan.toLowerCase().startsWith('ket:')) {
    keterangan = keterangan.replace(/^ket:\s*/i, '').trim();
  }

  const grandTotal = receipt.totalAmount || (ayamTotal + atiTotal + ususTotal);

  return {
    no: index + 1,
    customerName: receipt.customerName,
    ekor,
    ayamKg: Math.round(ayamKg * 10) / 10,
    ayamPrice,
    ayamTotal,
    atiBiji,
    atiPrice,
    atiTotal,
    ususKg: Math.round(ususKg * 10) / 10,
    ususPrice,
    ususTotal,
    grandTotal,
    keterangan,
  };
};

/**
 * Exports data into native Excel (.xlsx) file matching the Google Sheet format
 * Includes formulas: H*I for Ayam, K*L for Ati, N*O for Usus, J+M+P for Grand Total,
 * and SUM formulas in the summary row.
 */
export const exportToExcelGoogleSheetFormat = (
  receipts: AyamAnugrahReceipt[],
  dateLabel?: string
) => {
  const wb = XLSX.utils.book_new();
  const dateStr = dateLabel || (receipts.length > 0 ? receipts[0].date : '1 November 2026');

  // Initial 2D table grid with empty slots up to column R (18 columns: 0..17)
  const emptyRow = () => new Array(18).fill('');

  const grid: any[][] = [];
  // Row 0: DATA HARIAN GUDANG
  const r0 = emptyRow();
  r0[0] = 'DATA HARIAN GUDANG';
  grid.push(r0);

  // Row 1: "AYAM  @ ANUGRAH"
  const r1 = emptyRow();
  r1[0] = '"AYAM  @ ANUGRAH"';
  grid.push(r1);

  // Row 2, 3: Blank
  grid.push(emptyRow());
  grid.push(emptyRow());

  // Row 4: TANGGAL
  const r4 = emptyRow();
  r4[0] = `TANGGAL : ${dateStr}`;
  r4[1] = dateStr;
  grid.push(r4);

  // Row 5: Blank
  grid.push(emptyRow());

  // Row 6 (Row 7 in 1-based index): Main Headers
  const r6 = emptyRow();
  r6[0] = 'NO';
  r6[1] = 'NAMA';
  r6[2] = 'EKOR';
  r6[3] = 'AYAM GEBRUS';
  r6[7] = 'JMLH';
  r6[8] = 'HARGA';
  r6[9] = 'JUMLAH';
  r6[10] = 'ATI';
  r6[12] = 'JUMLAH';
  r6[13] = 'USUS';
  r6[15] = 'JUMLAH';
  r6[16] = 'JUMLAH';
  r6[17] = 'KETERANGAN';
  grid.push(r6);

  // Row 7 (Row 8 in 1-based index): Sub Headers
  const r7 = emptyRow();
  r7[10] = 'BIJI';
  r7[11] = 'HARGA';
  r7[13] = 'KG';
  r7[14] = 'HARGA';
  r7[16] = 'KESELURUHAN';
  grid.push(r7);

  const ws = XLSX.utils.aoa_to_sheet(grid);

  // Set merges matching the Google Sheet exactly
  ws['!merges'] = [
    { s: { c: 0, r: 0 }, e: { c: 17, r: 0 } }, // A1:R1 DATA HARIAN GUDANG
    { s: { c: 0, r: 1 }, e: { c: 17, r: 1 } }, // A2:R2 AYAM @ ANUGRAH
    { s: { c: 0, r: 6 }, e: { c: 0, r: 7 } },   // A7:A8 NO
    { s: { c: 1, r: 6 }, e: { c: 1, r: 7 } },   // B7:B8 NAMA
    { s: { c: 2, r: 6 }, e: { c: 2, r: 7 } },   // C7:C8 EKOR
    { s: { c: 3, r: 6 }, e: { c: 6, r: 7 } },   // D7:G8 AYAM GEBRUS
    { s: { c: 7, r: 6 }, e: { c: 7, r: 7 } },   // H7:H8 JMLH
    { s: { c: 8, r: 6 }, e: { c: 8, r: 7 } },   // I7:I8 HARGA
    { s: { c: 9, r: 6 }, e: { c: 9, r: 7 } },   // J7:J8 JUMLAH
    { s: { c: 10, r: 6 }, e: { c: 11, r: 6 } }, // K7:L7 ATI
    { s: { c: 12, r: 6 }, e: { c: 12, r: 7 } }, // M7:M8 JUMLAH
    { s: { c: 13, r: 6 }, e: { c: 14, r: 6 } }, // N7:O7 USUS
    { s: { c: 15, r: 6 }, e: { c: 15, r: 7 } }, // P7:P8 JUMLAH
    { s: { c: 17, r: 6 }, e: { c: 17, r: 7 } }, // R7:R8 KETERANGAN
  ];

  // Set Column widths
  ws['!cols'] = [
    { wch: 6 },  // A: NO
    { wch: 16 }, // B: NAMA
    { wch: 8 },  // C: EKOR
    { wch: 6 },  // D: AYAM GEBRUS slot 1
    { wch: 6 },  // E: slot 2
    { wch: 6 },  // F: slot 3
    { wch: 6 },  // G: slot 4
    { wch: 10 }, // H: JMLH (KG)
    { wch: 15 }, // I: HARGA
    { wch: 18 }, // J: JUMLAH
    { wch: 8 },  // K: ATI BIJI
    { wch: 12 }, // L: ATI HARGA
    { wch: 16 }, // M: ATI JUMLAH
    { wch: 8 },  // N: USUS KG
    { wch: 12 }, // O: USUS HARGA
    { wch: 16 }, // P: USUS JUMLAH
    { wch: 20 }, // Q: JUMLAH KESELURUHAN
    { wch: 18 }, // R: KETERANGAN
  ];

  // Populate data rows starting at Row 9 (1-based index)
  let sumEkor = 0;
  let sumAyamKg = 0;
  let sumAyamTotal = 0;
  let sumAtiBiji = 0;
  let sumAtiTotal = 0;
  let sumUsusKg = 0;
  let sumUsusTotal = 0;
  let sumGrandTotal = 0;

  const startRow = 9;
  receipts.forEach((receipt, idx) => {
    const rowNum = startRow + idx;
    const item = parseReceiptToWarehouseRow(receipt, idx);

    sumEkor += item.ekor;
    sumAyamKg += item.ayamKg;
    sumAyamTotal += item.ayamTotal;
    sumAtiBiji += item.atiBiji;
    sumAtiTotal += item.atiTotal;
    sumUsusKg += item.ususKg;
    sumUsusTotal += item.ususTotal;
    sumGrandTotal += item.grandTotal;

    // Set cells with values, styles, and formulas
    ws['A' + rowNum] = { t: 'n', v: item.no };
    ws['B' + rowNum] = { t: 's', v: item.customerName };
    ws['C' + rowNum] = { t: 'n', v: item.ekor };

    // Ayam Gebrus
    ws['H' + rowNum] = { t: 'n', v: item.ayamKg, z: '#,##0.0' };
    ws['I' + rowNum] = { t: 'n', v: item.ayamPrice, z: '" Rp "#,##0.00' };
    ws['J' + rowNum] = {
      t: 'n',
      f: `H${rowNum}*I${rowNum}`,
      v: item.ayamTotal,
      z: '" Rp "#,##0.00',
    };

    // Ati
    if (item.atiBiji > 0) {
      ws['K' + rowNum] = { t: 'n', v: item.atiBiji };
      ws['L' + rowNum] = { t: 'n', v: item.atiPrice, z: '" Rp "#,##0.00' };
      ws['M' + rowNum] = {
        t: 'n',
        f: `K${rowNum}*L${rowNum}`,
        v: item.atiTotal,
        z: '" Rp "#,##0.00',
      };
    } else {
      ws['M' + rowNum] = { t: 'n', v: 0, z: '" Rp "#,##0.00' };
    }

    // Usus
    if (item.ususKg > 0) {
      ws['N' + rowNum] = { t: 'n', v: item.ususKg };
      ws['O' + rowNum] = { t: 'n', v: item.ususPrice, z: '" Rp "#,##0.00' };
      ws['P' + rowNum] = {
        t: 'n',
        f: `N${rowNum}*O${rowNum}`,
        v: item.ususTotal,
        z: '" Rp "#,##0.00',
      };
    } else {
      ws['P' + rowNum] = { t: 'n', v: 0, z: '" Rp "#,##0.00' };
    }

    // Grand total
    ws['Q' + rowNum] = {
      t: 'n',
      f: `J${rowNum}+M${rowNum}+P${rowNum}`,
      v: item.grandTotal,
      z: '" Rp "#,##0.00',
    };

    // Keterangan (e.g. Pita Hitam, Pita Putih, Pita Ungu)
    if (item.keterangan) {
      ws['R' + rowNum] = { t: 's', v: item.keterangan };
    }
  });

  const lastDataRow = startRow + receipts.length - 1;
  const summaryRow = lastDataRow + 3; // Leaves blank rows like the original Google Sheet

  // Row before summary can have placeholder Rp -
  ws['Q' + (summaryRow - 1)] = { t: 'n', v: 0, z: '" Rp "#,##0.00' };

  // Summary Row
  ws['B' + summaryRow] = { t: 's', v: 'JUMLAH' };
  ws['C' + summaryRow] = { t: 'n', f: `SUM(C${startRow}:C${lastDataRow})`, v: sumEkor };
  ws['D' + summaryRow] = { t: 'n', v: 0 };
  ws['E' + summaryRow] = { t: 'n', v: 0 };
  ws['F' + summaryRow] = { t: 'n', v: 0 };
  ws['H' + summaryRow] = { t: 'n', f: `SUM(H${startRow}:H${lastDataRow})`, v: Math.round(sumAyamKg * 10) / 10, z: '#,##0.0' };
  ws['J' + summaryRow] = { t: 'n', f: `SUM(J${startRow}:J${lastDataRow})`, v: sumAyamTotal, z: '" Rp "#,##0.00' };
  ws['K' + summaryRow] = { t: 'n', f: `SUM(K${startRow}:K${lastDataRow})`, v: sumAtiBiji };
  ws['M' + summaryRow] = { t: 'n', f: `SUM(M${startRow}:M${lastDataRow})`, v: sumAtiTotal, z: '" Rp "#,##0.00' };
  ws['N' + summaryRow] = { t: 'n', f: `SUM(N${startRow}:N${lastDataRow})`, v: Math.round(sumUsusKg * 10) / 10 };
  ws['P' + summaryRow] = { t: 'n', f: `SUM(P${startRow}:P${lastDataRow})`, v: sumUsusTotal, z: '" Rp "#,##0.00' };
  ws['Q' + summaryRow] = { t: 'n', f: `SUM(Q${startRow}:Q${lastDataRow})`, v: sumGrandTotal, z: '" Rp "#,##0.00' };

  // Update sheet reference range
  ws['!ref'] = `A1:R${summaryRow}`;

  // Add worksheet to workbook (sheet name: Oktober / November)
  XLSX.utils.book_append_sheet(wb, ws, 'Gudang Ayam Anugrah');

  // Generate buffer and trigger download
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = `DATA_HARIAN_GUDANG_AYAM_ANUGRAH_${sanitizeFilename(dateStr)}.xlsx`;
  downloadBlob(blob, filename);
};

/**
 * Exports data into formatted CSV exactly matching the Google Sheet CSV export
 */
export const exportToCsvGoogleSheetFormat = (
  receipts: AyamAnugrahReceipt[],
  dateLabel?: string
) => {
  const dateStr = dateLabel || (receipts.length > 0 ? receipts[0].date : '1 November 2026');

  const formatRupiahCsv = (val: number): string => {
    if (val === 0) return ' Rp -   ';
    return ` Rp ${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)} `;
  };

  const formatNumberIndo = (val: number): string => {
    return String(val).replace('.', ',');
  };

  const lines: string[] = [
    'DATA HARIAN GUDANG,,,,,,,,,,,,,,,,,',
    '"""AYAM  @ ANUGRAH""",,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,',
    `TANGGAL : ${dateStr},${dateStr},,,,,,,,,,,,,,,,`,
    ',,,,,,,,,,,,,,,,,',
    'NO,NAMA,EKOR,AYAM GEBRUS,,,,JMLH,HARGA,JUMLAH,ATI,,JUMLAH,USUS,,JUMLAH,JUMLAH,KETERANGAN',
    ',,,,,,,,,,BIJI,HARGA,,KG,HARGA,,KESELURUHAN,',
  ];

  let sumEkor = 0;
  let sumAyamKg = 0;
  let sumAyamTotal = 0;
  let sumAtiBiji = 0;
  let sumAtiTotal = 0;
  let sumUsusKg = 0;
  let sumUsusTotal = 0;
  let sumGrandTotal = 0;

  receipts.forEach((r, idx) => {
    const it = parseReceiptToWarehouseRow(r, idx);
    sumEkor += it.ekor;
    sumAyamKg += it.ayamKg;
    sumAyamTotal += it.ayamTotal;
    sumAtiBiji += it.atiBiji;
    sumAtiTotal += it.atiTotal;
    sumUsusKg += it.ususKg;
    sumUsusTotal += it.ususTotal;
    sumGrandTotal += it.grandTotal;

    const row = [
      String(it.no),
      it.customerName,
      String(it.ekor),
      '', '', '', '', // D, E, F, G
      formatNumberIndo(it.ayamKg),
      `"${formatRupiahCsv(it.ayamPrice)}"`,
      `"${formatRupiahCsv(it.ayamTotal)}"`,
      it.atiBiji > 0 ? String(it.atiBiji) : '',
      it.atiPrice > 0 ? `"${formatRupiahCsv(it.atiPrice)}"` : '',
      `"${formatRupiahCsv(it.atiTotal)}"`,
      it.ususKg > 0 ? formatNumberIndo(it.ususKg) : '',
      it.ususPrice > 0 ? `"${formatRupiahCsv(it.ususPrice)}"` : '',
      `"${formatRupiahCsv(it.ususTotal)}"`,
      `"${formatRupiahCsv(it.grandTotal)}"`,
      it.keterangan || '',
    ];
    lines.push(row.join(','));
  });

  // Placeholder and blank lines before summary
  lines.push(',,,,,,,,,,,,,,,, Rp -   ,');
  lines.push(',,,,,,,,,,,,,,,,,');
  lines.push(',,,,,,,,,,,,,,,,,');

  // Summary Row
  const summary = [
    '',
    'JUMLAH',
    String(sumEkor),
    '0', '0', '0', '',
    `"${formatNumberIndo(Math.round(sumAyamKg * 10) / 10)}"`,
    '',
    `"${formatRupiahCsv(sumAyamTotal)}"`,
    String(sumAtiBiji),
    '',
    `"${formatRupiahCsv(sumAtiTotal)}"`,
    String(Math.round(sumUsusKg * 10) / 10),
    '',
    `"${formatRupiahCsv(sumUsusTotal)}"`,
    `"${formatRupiahCsv(sumGrandTotal)}"`,
    '',
  ];
  lines.push(summary.join(','));

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `DATA_HARIAN_GUDANG_AYAM_ANUGRAH_${sanitizeFilename(dateStr)}.csv`;
  downloadBlob(blob, filename);
};

