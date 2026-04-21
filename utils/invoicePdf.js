import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { sumToWordsRuTenge } from "./sumToWordsRu.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = path.join(__dirname, "../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const FONT_BOLD_PATH = path.join(__dirname, "../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");
const PDF_TITLE_PNG = path.join(__dirname, "../pdfTitle.png");
const PDF_END_PNG = path.join(__dirname, "../pdfEnd.png");

const STATIC = {
    beneficiaryCompany:
        'Товарищество с ограниченной ответственностью "Verto Business (Верто Бизнес)"',
    beneficiaryBin: "БИН: 220340005670",
    beneficiaryBank: 'АО "ForteBank"',
    iik: "KZ1596521F0008530262",
    kbe: "17",
    bik: "IRTYKZKA",
    paymentCode: "859",
    executorBlock:
        'Товарищество с ограниченной ответственностью "Verto Business (Верто Бизнес)", БИН 220340005670, 050000, Казахстан, г. Алматы, мкр. Нурлытау, ул. Г. Баязитовой, д. 12',
    contract: "На основании публичной оферты",
    noticeHeader:
        "Внимание! Оплата данного счета означает согласие с условиями поставки товара. Уведомление об оплате обязательно, в противном случае не гарантируется наличие товара на складе. Товар отпускается по факту прихода денег на р/с Поставщика, самовывозом при наличии доверенности и документов удостоверающих личность.",
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

/** Шапка: слева pdfTitle.png (50% ширины) или текст; справа уведомление */
function drawInvoiceHeaderBanner(doc, left, y, pageW) {
    const notice = STATIC.noticeHeader;
    const textW = pageW * 0.48;
    const textX = left + pageW * 0.52;
    doc.font("main").fontSize(7).fillColor("#000000");

    let leftBlockH = 0;
    if (fs.existsSync(PDF_TITLE_PNG)) {
        const img = doc.openImage(PDF_TITLE_PNG);
        const imgW = pageW * 0.5;
        leftBlockH = (img.height / img.width) * imgW;
        doc.image(PDF_TITLE_PNG, left, y, { width: imgW });
    } else {
        doc.fontSize(8);
        const fallback = "Тибетская since 1996";
        leftBlockH = doc.heightOfString(fallback, { width: pageW * 0.45 });
        doc.text(fallback, left, y, { width: pageW * 0.45 });
        doc.fontSize(7);
    }

    const textH = doc.heightOfString(notice, { width: textW, align: "right" });
    doc.text(notice, textX, y, { width: textW, align: "right" });

    const rowH = Math.max(leftBlockH, textH);
    return y + rowH;
}

const TABLE_PAD = 4;
const STROKE = 0.45;

function setThinStroke(doc) {
    doc.lineWidth(STROKE).strokeColor("#000000");
}

/**
 * Одна колонка, строки с рамкой и горизонтальными линиями.
 * @returns {number} y после таблицы
 */
function drawSingleColumnTable(doc, x, y, width, rows, options) {
    const { fontSize = 7, align = "left" } = options || {};
    doc.font("main").fontSize(fontSize).fillColor("#000000");
    const pad = TABLE_PAD;
    const innerW = width - pad * 2;
    const rowHeights = rows.map((text) => {
        const h = doc.heightOfString(String(text), { width: innerW, align });
        return Math.max(h + pad * 2, fontSize + pad * 2);
    });
    const totalH = rowHeights.reduce((a, b) => a + b, 0);
    setThinStroke(doc);
    doc.rect(x, y, width, totalH).stroke();
    let cy = y;
    for (let i = 0; i < rows.length - 1; i++) {
        cy += rowHeights[i];
        doc.moveTo(x, cy).lineTo(x + width, cy).stroke();
    }
    cy = y;
    for (let i = 0; i < rows.length; i++) {
        doc.text(String(rows[i]), x + pad, cy + pad, {
            width: innerW,
            align,
        });
        cy += rowHeights[i];
    }
    return y + totalH;
}

/**
 * Таблица с сеткой: colWidths — ширины колонок, rows — массив строк (массив ячеек).
 * columnAligns — выравнивание по колонкам для строк данных (шапка — headerAlign).
 * @returns {{ y: number }}
 */
function drawGridTable(doc, x, y, colWidths, rows, options) {
    const { fontSize = 7, headerAlign = "left", columnAligns } = options || {};
    const pad = TABLE_PAD;
    const tableW = colWidths.reduce((a, b) => a + b, 0);
    doc.font("main").fontSize(fontSize).fillColor("#000000");

    const rowHeights = rows.map((cells, rowIndex) => {
        let maxInner = 0;
        cells.forEach((text, j) => {
            const w = colWidths[j] - pad * 2;
            const align =
                rowIndex === 0
                    ? columnAligns?.[j] ?? headerAlign
                    : columnAligns?.[j] ?? "left";
            const h = doc.heightOfString(String(text), { width: w, align });
            maxInner = Math.max(maxInner, h);
        });
        return Math.max(maxInner + pad * 2, fontSize + pad * 2);
    });

    const totalH = rowHeights.reduce((a, b) => a + b, 0);
    setThinStroke(doc);
    doc.rect(x, y, tableW, totalH).stroke();

    let cx = x;
    for (let c = 0; c < colWidths.length - 1; c++) {
        cx += colWidths[c];
        doc.moveTo(cx, y).lineTo(cx, y + totalH).stroke();
    }

    let cy = y;
    for (let r = 0; r < rows.length - 1; r++) {
        cy += rowHeights[r];
        doc.moveTo(x, cy).lineTo(x + tableW, cy).stroke();
    }

    cy = y;
    rows.forEach((cells, r) => {
        let cx2 = x;
        cells.forEach((text, j) => {
            const align =
                r === 0 ? columnAligns?.[j] ?? headerAlign : columnAligns?.[j] ?? "left";
            doc.text(String(text), cx2 + pad, cy + pad, {
                width: colWidths[j] - pad * 2,
                align,
            });
            cx2 += colWidths[j];
        });
        cy += rowHeights[r];
    });

    return { y: y + totalH };
}

function measureLineHeight(doc, fontName, text, innerW) {
    doc.font(fontName);
    return doc.heightOfString(text, { width: innerW });
}

/** Рисует набор строк в ячейке; возвращает финальный y под ячейкой (внутри таблицы). */
function drawMultilineCell(doc, x, startY, innerW, lines) {
    let ty = startY;
    for (const { font, text } of lines) {
        doc.font(font);
        doc.text(text, x, ty, { width: innerW });
        ty += doc.heightOfString(text, { width: innerW });
    }
    return ty;
}

/**
 * Таблица банка 3×2 без лишних объединений: одинаковая ширина 1-й колонки в обеих строках.
 * Строка 1: бенефициар | ИИК | КБе. Строка 2: банк | БИК | код платежа.
 * @returns {number} y после таблицы
 */
function drawBankBeneficiaryGrid(doc, left, y, pageW) {
    const pad = TABLE_PAD;
    const fs = 7;
    doc.fontSize(fs).fillColor("#000000");

    const w1 = Math.floor(pageW * 0.42);
    const w2 = Math.floor(pageW * 0.29);
    const w3 = pageW - w1 - w2;
    const colW = [w1, w2, w3];
    const inner = colW.map((w) => w - 2 * pad);

    const company = STATIC.beneficiaryCompany;
    const binLine = STATIC.beneficiaryBin;

    const hR1C1 =
        measureLineHeight(doc, "mainBold", "Бенефициар:", inner[0]) +
        measureLineHeight(doc, "mainBold", company, inner[0]) +
        measureLineHeight(doc, "main", binLine, inner[0]);
    const hR1C2 =
        measureLineHeight(doc, "mainBold", "ИИК", inner[1]) +
        measureLineHeight(doc, "mainBold", STATIC.iik, inner[1]);
    const hR1C3 =
        measureLineHeight(doc, "mainBold", "КБе", inner[2]) +
        measureLineHeight(doc, "mainBold", STATIC.kbe, inner[2]);

    const row1H = Math.max(hR1C1, hR1C2, hR1C3) + 2 * pad;

    const hR2C1 =
        measureLineHeight(doc, "mainBold", "Банк бенефициара:", inner[0]) +
        measureLineHeight(doc, "main", STATIC.beneficiaryBank, inner[0]);
    const hR2C2 =
        measureLineHeight(doc, "mainBold", "БИК", inner[1]) +
        measureLineHeight(doc, "mainBold", STATIC.bik, inner[1]);
    const hR2C3 =
        measureLineHeight(doc, "mainBold", "Код назначения платежа", inner[2]) +
        measureLineHeight(doc, "mainBold", STATIC.paymentCode, inner[2]);

    const row2H = Math.max(hR2C1, hR2C2, hR2C3) + 2 * pad;

    const tableW = w1 + w2 + w3;
    const totalH = row1H + row2H;

    setThinStroke(doc);
    doc.rect(left, y, tableW, totalH).stroke();
    doc.moveTo(left + w1, y).lineTo(left + w1, y + totalH).stroke();
    doc.moveTo(left + w1 + w2, y).lineTo(left + w1 + w2, y + totalH).stroke();
    doc.moveTo(left, y + row1H).lineTo(left + tableW, y + row1H).stroke();

    const y1 = y + pad;
    drawMultilineCell(doc, left + pad, y1, inner[0], [
        { font: "mainBold", text: "Бенефициар:" },
        { font: "mainBold", text: company },
        { font: "main", text: binLine },
    ]);
    drawMultilineCell(doc, left + w1 + pad, y1, inner[1], [
        { font: "mainBold", text: "ИИК" },
        { font: "mainBold", text: STATIC.iik },
    ]);
    drawMultilineCell(doc, left + w1 + w2 + pad, y1, inner[2], [
        { font: "mainBold", text: "КБе" },
        { font: "mainBold", text: STATIC.kbe },
    ]);

    const y2 = y + row1H + pad;
    drawMultilineCell(doc, left + pad, y2, inner[0], [
        { font: "mainBold", text: "Банк бенефициара:" },
        { font: "main", text: STATIC.beneficiaryBank },
    ]);
    drawMultilineCell(doc, left + w1 + pad, y2, inner[1], [
        { font: "mainBold", text: "БИК" },
        { font: "mainBold", text: STATIC.bik },
    ]);
    drawMultilineCell(doc, left + w1 + w2 + pad, y2, inner[2], [
        { font: "mainBold", text: "Код назначения платежа" },
        { font: "mainBold", text: STATIC.paymentCode },
    ]);

    return y + totalH;
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
    if (!fs.existsSync(FONT_BOLD_PATH)) {
        throw new Error(`Шрифт Bold для PDF не найден: ${FONT_BOLD_PATH}`);
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
        doc.registerFont("mainBold", FONT_BOLD_PATH);
        doc.font("main");

        let y = doc.y;
        const left = doc.page.margins.left;
        const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        y = drawInvoiceHeaderBanner(doc, left, y, pageW);
        y += 10;

        y = drawBankBeneficiaryGrid(doc, left, y, pageW);
        y += 8;

        const titleText = `Счет на оплату № ${invoiceNumber} от ${formatDate(invoiceDate)}`;
        doc.font("mainBold").fontSize(11).fillColor("#000000");
        doc.text(titleText, left, y, { width: pageW});
        y = doc.y + 10;
        doc.font("main").fontSize(8);
        doc.text(`Исполнитель: ${STATIC.executorBlock}`, left, y, { width: pageW });
        y = doc.y + 6;
        doc.text(`Покупатель: ${buyer}`, left, y, { width: pageW });
        y = doc.y + 6;
        doc.text(`Договор: ${STATIC.contract}`, left, y, { width: pageW });
        y = doc.y + 10;

        const colW = [
            22,
            48,
            230,
            30,
            30,
            40,
            Math.max(52, pageW - 22 - 48 - 230 - 30 - 30 - 40),
        ];
        const colAlign = ["left", "left", "left", "right", "center", "right", "right"];
        const tableRows = [
            ["№", "Код", "Наименование", "Кол-во", "Ед.", "Цена", "Сумма"],
        ];
        let n = 1;
        if (qty19 > 0) {
            const name19 =
                'Оплата за обеспечение доступа к сервису и ресурсам экосистемы «Тибетская» (пакет «Water 19L») согласно условиям публичной оферты';
            tableRows.push([
                String(n),
                STATIC.code19,
                name19,
                String(qty19),
                "Ус/шт.",
                formatMoney(price19),
                formatMoney(line19),
            ]);
            n++;
        }
        if (qty12 > 0) {
            const name12 =
                'Оплата за обеспечение доступа к сервису и ресурсам экосистемы «Тибетская» (пакет «Water 12L») согласно условиям публичной оферты';
            tableRows.push([
                String(n),
                STATIC.code12,
                name12,
                String(qty12),
                "Ус/шт.",
                formatMoney(price12),
                formatMoney(line12),
            ]);
        }

        const itemsBottom = drawGridTable(doc, left, y, colW, tableRows, {
            fontSize: 7,
            headerAlign: "left",
            columnAligns: colAlign,
        });
        y = itemsBottom.y + 8;
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
        y = doc.y + 8;

        if (fs.existsSync(PDF_END_PNG)) {
            const endImg = doc.openImage(PDF_END_PNG);
            const endW = pageW * 0.25;
            const endH = (endImg.height / endImg.width) * endW;
            doc.image(PDF_END_PNG, left, y, { width: endW });
            y += endH;
        }

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
