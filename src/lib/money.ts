/**
 * Helper tampilan uang kas rumah (yen).
 *
 * Semua nominal disimpan sebagai integer JPY di database, jadi format cukup
 * satu tempat: pemisah ribuan gaya Indonesia (titik) dan tanda "minus" ditulis
 * manual agar tidak bergantung pada perilaku `style: "currency"` ICU yang berbeda
 * antar browser (sebagian merender "JP¥" atau "(¥1.200)").
 */

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

/**
 * Format nominal yen untuk ditampilkan, mis. `12400` -> `"¥12.400"`.
 *
 * @param amountJpy Nominal yen (boleh negatif; tanda ditulis di depan simbol).
 * @returns Label uang.
 */
export function formatMoneyLabel(amountJpy: number): string {
  const sign = amountJpy < 0 ? "-" : "";

  return `${sign}¥${numberFormatter.format(Math.abs(amountJpy))}`;
}

/**
 * Bagian talangan yang menjadi beban kaleng kas dari satu pengeluaran bersama.
 *
 * Bila harga barang A ditanggung S orang, pembayar menyerahkan seluruh A lebih
 * dulu padahal bagian wajarinya sendiri hanya `floor(A / S)`. Selisihnya yang
 * dipinjam kaleng kas kepadanya. Sisa hasil pembulatan ke bawah ikut ditanggung
 * pembayar, sehingga talangan tidak pernah melebihi harga barang.
 *
 * @param grossAmountJpy Harga barang sebagai bilangan bulat positif.
 * @param splitCount Jumlah orang yang menanggung bersama.
 * @returns Nominal yang harus dikembalikan kaleng kas ke pembayar.
 * @example advanceOwedJpy(5000, 3) // 3334
 */
export function advanceOwedJpy(grossAmountJpy: number, splitCount: number): number {
  const people = Math.max(1, Math.trunc(splitCount));
  const ownShare = Math.trunc(Math.abs(grossAmountJpy) / people);

  return Math.abs(grossAmountJpy) - ownShare;
}

/**
 * Format nominal dengan tanda plus/minus eksplisit untuk baris riwayat,
 * mis. `5000` -> `"+¥5.000"`, `-2800` -> `"-¥2.800"`.
 *
 * @param amountJpy Nominal bertanda seperti kolom `money_transactions.amount_jpy`.
 * @returns Label uang bertanda; nol ditampilkan tanpa tanda.
 */
export function formatMoneyDeltaLabel(amountJpy: number): string {
  if (amountJpy === 0) {
    return formatMoneyLabel(0);
  }

  const sign = amountJpy > 0 ? "+" : "-";

  return `${sign}¥${numberFormatter.format(Math.abs(amountJpy))}`;
}
