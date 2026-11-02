// Angka -> kata bahasa Indonesia (untuk naskah VO). 3.8 -> "tiga koma delapan", 2026 -> "dua ribu dua puluh enam".
const ONES = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];

function belowThousand(n) {
  const out = [];
  const h = Math.floor(n / 100), r = n % 100;
  if (h === 1) out.push("seratus");
  else if (h > 1) out.push(ONES[h] + " ratus");
  if (r === 0) { /* kosong */ }
  else if (r < 10) out.push(ONES[r]);
  else if (r === 10) out.push("sepuluh");
  else if (r === 11) out.push("sebelas");
  else if (r < 20) out.push(ONES[r - 10] + " belas");
  else out.push(ONES[Math.floor(r / 10)] + " puluh" + (r % 10 ? " " + ONES[r % 10] : ""));
  return out.join(" ");
}

export function intWords(n) {
  n = Math.trunc(Math.abs(n));
  if (n === 0) return "nol";
  const parts = [];
  const scales = [[1e12, "triliun"], [1e9, "miliar"], [1e6, "juta"], [1e3, "ribu"]];
  for (const [v, name] of scales) {
    const q = Math.floor(n / v);
    if (q > 0) {
      parts.push(v === 1e3 && q === 1 ? "seribu" : belowThousand(q) + " " + name);
      n -= q * v;
    }
  }
  if (n > 0) parts.push(belowThousand(n));
  return parts.join(" ");
}

// Desimal memakai koma; digit pecahan dibaca satu per satu ("13,7" -> "tiga belas koma tujuh").
export function numWords(value) {
  const s = String(value).trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`bukan angka: "${value}"`);
  const [i, f] = s.replace("-", "").split(".");
  let w = intWords(Number(i));
  if (f) w += " koma " + f.split("").map((d) => ONES[+d]).join(" ");
  return (s.startsWith("-") ? "minus " : "") + w;
}
