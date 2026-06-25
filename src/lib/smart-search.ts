// Smart search with Bangla support + fuzzy matching (typo tolerant)

// Common Bangla ↔ English food synonym map. Add more freely.
const SYNONYMS: Record<string, string[]> = {
  cha: ["চা", "tea", "chai"],
  chap: ["চাপ", "chaap"],
  burger: ["বার্গার", "বরগার"],
  nacho: ["নাচো", "নাচোস", "nachos"],
  pizza: ["পিজা", "পিৎজা", "পিজ্জা"],
  biryani: ["বিরিয়ানি", "বিরানি", "biriyani", "briyani"],
  kebab: ["কাবাব", "কেবাব", "kabab"],
  chicken: ["চিকেন", "মুরগি", "মুরগী"],
  beef: ["বিফ", "গরু", "গরুর"],
  mutton: ["মাটন", "খাসি", "খাসির"],
  fish: ["ফিশ", "মাছ"],
  rice: ["রাইস", "ভাত", "পোলাও", "polao", "pulao"],
  paratha: ["পরোটা", "পরাটা", "porota"],
  roll: ["রোল"],
  shawarma: ["শর্মা", "শাওয়ারমা", "shorma"],
  coffee: ["কফি"],
  lassi: ["লাচ্ছি", "লাসসি"],
  juice: ["জুস", "জ্যুস"],
  drink: ["ড্রিংক", "পানীয়"],
  cold: ["কোল্ড", "ঠান্ডা"],
  hot: ["হট", "গরম"],
  set: ["সেট"],
  combo: ["কম্বো"],
  spicy: ["মশলাদার", "ঝাল"],
  fry: ["ফ্রাই", "ভাজা"],
  grill: ["গ্রিল"],
  wings: ["উইংস", "উইংগস"],
  noodles: ["নুডলস", "নুডুলস"],
  pasta: ["পাস্তা"],
  sandwich: ["স্যান্ডউইচ", "সেন্ডউইচ"],
  egg: ["ডিম", "এগ"],
  cheese: ["চিজ", "চিস"],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    // strip Bangla vowel signs/nukta/halant for loose matching
    .replace(/[\u0981-\u0983\u09BC-\u09CD\u09D7\u09E2\u09E3]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Build expanded haystack with synonyms attached
function expand(text: string): string {
  const base = normalize(text);
  const extra: string[] = [];
  for (const [en, alts] of Object.entries(SYNONYMS)) {
    const n = [en, ...alts].map(normalize);
    if (n.some((t) => t && base.includes(t))) extra.push(en, ...alts.map(normalize));
  }
  return [base, ...extra].join(" ");
}

// Levenshtein distance
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

function expandQuery(q: string): string[] {
  const n = normalize(q);
  if (!n) return [];
  const out = new Set<string>([n]);
  for (const [en, alts] of Object.entries(SYNONYMS)) {
    const all = [en, ...alts].map(normalize);
    if (all.some((t) => t && (t.includes(n) || n.includes(t)))) {
      all.forEach((t) => t && out.add(t));
    }
  }
  return [...out];
}

export function smartScore(query: string, ...fields: (string | null | undefined)[]): number {
  const qParts = expandQuery(query);
  if (!qParts.length) return 1;
  const hay = expand(fields.filter(Boolean).join(" "));
  if (!hay) return 0;

  let best = 0;
  for (const q of qParts) {
    if (hay.includes(q)) { best = Math.max(best, 1); continue; }
    // fuzzy per word
    for (const w of hay.split(" ")) {
      if (!w) continue;
      const d = lev(q, w);
      const tol = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
      if (d <= tol) {
        const score = 1 - d / Math.max(q.length, w.length);
        if (score > best) best = score;
      }
    }
  }
  return best;
}
