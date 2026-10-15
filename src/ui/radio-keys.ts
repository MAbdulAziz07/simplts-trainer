// Navigasi keyboard kelompok radio menurut pola WAI-ARIA: panah memindah pilihan dan berputar,
// Home/End ke ujung.

/** Indeks pilihan berikutnya untuk tombol `key`; `undefined` bila tombol itu bukan navigasi. */
export function nextRadioIndex(key: string, index: number, count: number): number | undefined {
  if (count <= 0) return undefined;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return undefined;
  }
}
