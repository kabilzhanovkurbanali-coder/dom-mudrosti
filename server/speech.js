// Text for the narrator's voice. The voice reads Latin words, Roman numerals
// and a few symbols badly, so the spoken version spells them out.
// The subtitles show the spoken text, so they always match the voice.

const ORDINAL_STEMS = [
  null, 'перв', 'втор', 'трет', 'четвёрт', 'пят', 'шест', 'седьм', 'восьм', 'девят', 'десят',
  'одиннадцат', 'двенадцат', 'тринадцат', 'четырнадцат', 'пятнадцат', 'шестнадцат', 'семнадцат',
  'восемнадцат', 'девятнадцат', 'двадцат',
];
// Ordinals stressed on the ending: «второй», not «вторый».
const STRESSED_END = new Set([2, 6, 7, 8]);

// Case of the ordinal from the form of «век» that follows it.
const CASE_BY_WORD = { век: 'nom', века: 'gen', веков: 'gen', веку: 'dat', веком: 'ins', веке: 'prep' };
const ENDINGS = { nom: 'ый', gen: 'ого', dat: 'ому', ins: 'ым', prep: 'ом' };
const THIRD = { nom: 'третий', gen: 'третьего', dat: 'третьему', ins: 'третьим', prep: 'третьем' };

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };

export function romanToNumber(roman) {
  let total = 0;
  for (let i = 0; i < roman.length; i++) {
    const value = ROMAN[roman[i]];
    const next = ROMAN[roman[i + 1]] ?? 0;
    total += value < next ? -value : value;
  }
  return total;
}

export function ordinal(n, grammaticalCase = 'nom') {
  if (n === 3) return THIRD[grammaticalCase];
  if (n > 20 && n < 30) return `двадцать ${ordinal(n - 20, grammaticalCase)}`;
  const stem = ORDINAL_STEMS[n];
  if (!stem) return String(n);
  if (grammaticalCase === 'nom' && STRESSED_END.has(n)) return `${stem}ой`;
  return stem + ENDINGS[grammaticalCase];
}

// «XII веке» → «двенадцатом веке», «VIII–XVI веков» → «восьмого — шестнадцатого веков».
function centuries(text) {
  return text.replace(
    /(?<![\p{L}\d])([IVXL]+)(?:\s*[–—-]\s*([IVXL]+))?(\s+)(век(?:а|ов|у|ом|е)?)(?![\p{L}])/gu,
    (_, a, b, space, word) => {
      const c = CASE_BY_WORD[word.toLowerCase()] ?? 'nom';
      const first = ordinal(romanToNumber(a), c);
      return b ? `${first} — ${ordinal(romanToNumber(b), c)}${space}${word}` : `${first}${space}${word}`;
    },
  );
}

const REPLACEMENTS = [
  [/«Dixit Algorizmi»/g, '«Диксит Алгоризми»'],
  [/Dixit Algorizmi/g, 'Диксит Алгоризми'],
  [/«Continens»/g, '«Континенс»'],
  [/Algorizmi/g, 'Алгоризми'],
  [/Мехмеду II(?![\p{L}])/gu, 'Мехмеду Второму'],
  [/Мурада III(?![\p{L}])/gu, 'Мурада Третьего'],
  [/(^|[\s(])ок\.\s/g, '$1около '],
  [/\s*\(см\.[^)]*\)/g, ''],
  [/(\d)\s*км(?![\p{L}])/gu, '$1 километров'],
  [/≈\s*/g, 'около '],
  [/π/g, 'пи'],
  [/В (\d{3,4})–(\d{3,4}) годах/g, 'С $1 по $2 год'],
];

export function speechText(text) {
  const replaced = REPLACEMENTS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
  return centuries(replaced);
}
