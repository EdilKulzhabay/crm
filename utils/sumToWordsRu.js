/**
 * Сумма прописью на русском для тенге (целая часть), без копеек/тиын в тексте числа.
 */

const onesF = [
    "",
    "одна",
    "две",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
];
const onesM = [
    "",
    "один",
    "два",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
];
const teens = [
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
];
const tens = [
    "",
    "десять",
    "двадцать",
    "тридцать",
    "сорок",
    "пятьдесят",
    "шестьдесят",
    "семьдесят",
    "восемьдесят",
    "девяносто",
];
const hundreds = [
    "",
    "сто",
    "двести",
    "триста",
    "четыреста",
    "пятьсот",
    "шестьсот",
    "семьсот",
    "восемьсот",
    "девятьсот",
];

function tripletToWords(n, feminine) {
    const o = feminine ? onesF : onesM;
    let s = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    if (h) s += hundreds[h] + " ";
    if (t === 1) {
        s += teens[u] + " ";
    } else {
        if (t) s += tens[t] + " ";
        if (u) s += o[u] + " ";
    }
    return s.trim();
}

function thousandForm(n) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n100 >= 11 && n100 <= 14) return "тысяч";
    if (n10 === 1) return "тысяча";
    if (n10 >= 2 && n10 <= 4) return "тысячи";
    return "тысяч";
}

function millionForm(n) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n100 >= 11 && n100 <= 14) return "миллионов";
    if (n10 === 1) return "миллион";
    if (n10 >= 2 && n10 <= 4) return "миллиона";
    return "миллионов";
}

/**
 * @param {number} amount — целое число тенге (>= 0)
 * @returns {string} например "Одна тысяча триста тенге"
 */
export function sumToWordsRuTenge(amount) {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 0) return "ноль тенге";
    if (n === 0) return "Ноль тенге";

    const parts = [];
    let rest = n;

    const millions = Math.floor(rest / 1_000_000);
    rest %= 1_000_000;
    const thousands = Math.floor(rest / 1000);
    rest %= 1000;

    if (millions) {
        const w = tripletToWords(millions, false);
        parts.push(w.charAt(0).toUpperCase() + w.slice(1) + " " + millionForm(millions));
    }
    if (thousands) {
        const w = tripletToWords(thousands, true);
        const prefix = parts.length ? w : w.charAt(0).toUpperCase() + w.slice(1);
        parts.push(prefix + " " + thousandForm(thousands));
    }
    if (rest || (!millions && !thousands)) {
        const w = tripletToWords(rest, false);
        if (!millions && !thousands) {
            parts.push(w.charAt(0).toUpperCase() + w.slice(1));
        } else if (rest) {
            parts.push(w);
        }
    }

    return parts.join(" ").trim() + " тенге";
}
