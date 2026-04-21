import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { sumToWordsRuTenge } from "./sumToWordsRu.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = path.join(__dirname, "../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf");

const STATIC = {
    beneficiary:
        'Товарищество с ограниченной ответственностью "Verto Business (Верто Бизнес)", БИН: 220340005670',
    beneficiaryBank: 'АО "ForteBank"',
    iik: "KZ1596521F0008530262",
    kbe: "17",
    bik: "IRTYKZKA",
    paymentCode: "859",
    executorBlock:
        'Товарищество с ограниченной ответственностью "Verto Business (Верто Бизнес)", БИН 220340005670, 050000, Казахстан, г. Алматы, мкр. Нурлытау, ул. Г. Баязитовой, д. 12',
    contract: "На основании публичной оферты",
    disclaimer:
        "Настоящим подтверждаю согласие с условиями поставки и оплаты. Обязуюсь уведомить о произведённой оплате.",
    code19: "000000000009",
    code12: "000000000008",
    signer: "/Арипбек Арай/",
};

function formatMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0,00";
    return v.toLocaleString("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDate(d) {
    const dt = d instanceof Date ? d : new Date();
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
}

/**
 * @param {object} params
 * @param {string} params.invoiceNumber — номер счёта (динам.)
 * @param {Date} [params.invoiceDate]
 * @param {string} params.buyer — текст блока «Покупатель» (как ввёл админ)
 * @param {number} params.qty19
 * @param {number} params.qty12
 * @param {number} params.price19
 * @param {number} params.price12
 */
export function buildInvoicePdfBuffer(params) {
    const {
        invoiceNumber,
        invoiceDate = new Date(),
        buyer,
        qty19,
        qty12,
        price19,
        price12,
    } = params;

    if (!fs.existsSync(FONT_PATH)) {
        throw new Error(`Шрифт для PDF не найден: ${FONT_PATH}`);
    }

    const line19 = qty19 > 0 ? qty19 * price19 : 0;
    const line12 = qty12 > 0 ? qty12 * price12 : 0;
    const total = line19 + line12;
    const rowCount = (qty19 > 0 ? 1 : 0) + (qty12 > 0 ? 1 : 0);
    const words = sumToWordsRuTenge(total);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: "A4",
            margin: 36,
            autoFirstPage: true,
        });
        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.registerFont("main", FONT_PATH);
        doc.font("main");

        let y = doc.y;
        const left = doc.page.margins.left;
        const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        doc.fontSize(8).fillColor("#000000");
        doc.text("Тибетская since 1996", left, y, { width: pageW * 0.45 });
        doc.text(STATIC.disclaimer, left + pageW * 0.48, y, {
            width: pageW * 0.52,
            align: "right",
        });
        y = doc.y + 10;

        doc.fontSize(7);
        const bankY = y;
        doc.text(`Бенефициар: ${STATIC.beneficiary}`, left, bankY, { width: pageW });
        y = doc.y + 2;
        doc.text(`Банк бенефициара: ${STATIC.beneficiaryBank}`, left, y, { width: pageW });
        y = doc.y + 2;
        doc.text(`ИИК: ${STATIC.iik}    КБе: ${STATIC.kbe}    БИК: ${STATIC.bik}`, left, y, {
            width: pageW,
        });
        y = doc.y + 2;
        doc.text(`Код назначения платежа: ${STATIC.paymentCode}`, left, y, { width: pageW });
        y = doc.y + 14;

        doc.fontSize(11).font("main");
        doc.text(
            `Счет на оплату № ${invoiceNumber} от ${formatDate(invoiceDate)}`,
            left,
            y,
            { width: pageW, align: "center" }
        );
        y = doc.y + 12;

        doc.fontSize(8);
        doc.text(`Исполнитель: ${STATIC.executorBlock}`, left, y, { width: pageW });
        y = doc.y + 6;
        doc.text(`Покупатель: ${buyer}`, left, y, { width: pageW });
        y = doc.y + 6;
        doc.text(`Договор: ${STATIC.contract}`, left, y, { width: pageW });
        y = doc.y + 10;

        const col = {
            c0: left,
            c1: left + 22,
            c2: left + 70,
            c3: left + 300,
            c4: left + 330,
            c5: left + 360,
            c6: left + 400,
            c7: left + 450,
        };
        const rowH = 36;

        doc.fontSize(7).fillColor("#000000");
        doc.text("№", col.c0, y, { width: 18 });
        doc.text("Код", col.c1, y, { width: 44 });
        doc.text("Наименование", col.c2, y, { width: 220 });
        doc.text("Кол-во", col.c3, y, { width: 26 });
        doc.text("Ед.", col.c4, y, { width: 26 });
        doc.text("Цена", col.c5, y, { width: 38 });
        doc.text("Сумма", col.c6, y, { width: 60 });
        y += 12;

        let n = 1;
        if (qty19 > 0) {
            doc.text(String(n), col.c0, y, { width: 18 });
            doc.text(STATIC.code19, col.c1, y, { width: 44 });
            const name19 =
                'Оплата за обеспечение доступа к сервису и ресурсам экосистемы «Тибетская» (пакет «Water 19L») согласно условиям публичной оферты';
            doc.text(name19, col.c2, y, { width: 220 });
            doc.text(String(qty19), col.c3, y, { width: 26 });
            doc.text("Ус/шт.", col.c4, y, { width: 26 });
            doc.text(formatMoney(price19), col.c5, y, { width: 38 });
            doc.text(formatMoney(line19), col.c6, y, { width: 60 });
            y += rowH;
            n++;
        }
        if (qty12 > 0) {
            doc.text(String(n), col.c0, y, { width: 18 });
            doc.text(STATIC.code12, col.c1, y, { width: 44 });
            const name12 =
                'Оплата за обеспечение доступа к сервису и ресурсам экосистемы «Тибетская» (пакет «Water 12L») согласно условиям публичной оферты';
            doc.text(name12, col.c2, y, { width: 220 });
            doc.text(String(qty12), col.c3, y, { width: 26 });
            doc.text("Ус/шт.", col.c4, y, { width: 26 });
            doc.text(formatMoney(price12), col.c5, y, { width: 38 });
            doc.text(formatMoney(line12), col.c6, y, { width: 60 });
            y += rowH;
        }

        y += 6;
        doc.fontSize(9);
        doc.text(`Итого: ${formatMoney(total)}`, left, y, { width: pageW });
        y = doc.y + 6;
        doc.fontSize(8);
        doc.text(
            `Всего наименований ${rowCount}, на сумму ${formatMoney(total)} KZT`,
            left,
            y,
            { width: pageW }
        );
        y = doc.y + 6;
        doc.text(`Всего к оплате: ${words} 00 тиын`, left, y, { width: pageW });
        y = doc.y + 20;

        doc.text("Исполнитель: _________________________", left, y, { width: pageW * 0.6 });
        y = doc.y + 4;
        doc.text(STATIC.signer, left, y, { width: pageW });

        doc.end();
    });
}

export function nextInvoiceSequentialNumber(current) {
    const t = String(current ?? "").trim();
    if (!t) return "1";
    if (!/^\d+$/.test(t)) return t;
    const len = t.length;
    const n = BigInt(t) + 1n;
    let out = String(n);
    if (len > 1 && t.startsWith("0") && out.length < len) {
        out = out.padStart(len, "0");
    }
    return out;
}
