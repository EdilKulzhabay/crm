import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
    decideTransactionMatch,
    evaluateInvoicePayment,
    extractBin,
    extractInvoiceNumberKeys,
    invoiceNumberKey,
    MATCH_ACTIONS,
} from "../invoiceMatching.js";

const BIN = "123456789012";
const OTHER_BIN = "987654321098";
const invoice = (overrides = {}) => ({
    _id: "inv1",
    number: "913",
    buyerBin: BIN,
    status: "issued",
    total: 30000,
    qty19: 20,
    qty12: 0,
    ...overrides,
});

describe("invoice number and BIN parsing", () => {
    test("finds the invoice number in real payment purposes from the Forte statement", () => {
        assert.deepEqual(extractInvoiceNumberKeys("Счет на оплату №913 от 04 октября 2026г.. вода"), ["913"]);
        assert.deepEqual(extractInvoiceNumberKeys("Оплата за доступ с-но счета № 915 от 05.10.26"), ["915"]);
        assert.deepEqual(extractInvoiceNumberKeys("согласно счета №885 от 24.09."), ["885"]);
        assert.deepEqual(extractInvoiceNumberKeys("Оплата по счёту 917"), ["917"]);
        assert.deepEqual(extractInvoiceNumberKeys("Назначение платежа: Оплата по счёту № 000918"), ["918"]);
    });

    test("does not take dates or amounts for an invoice number", () => {
        assert.deepEqual(extractInvoiceNumberKeys("За информационные услуги. Сумма 579 000-00 от 01.10.2026"), []);
    });

    test("leading zeros do not change the invoice key", () => {
        assert.equal(invoiceNumberKey("000913"), invoiceNumberKey("913"));
    });

    test("takes a labeled BIN first, otherwise the only 12-digit number", () => {
        assert.equal(extractBin(`ТОО «Ромашка», БИН: ${BIN}, ИИК KZ36601A871001725851`), BIN);
        assert.equal(extractBin(`ТОО «Ромашка» ${BIN} г. Алматы`), BIN);
        assert.equal(extractBin(`${BIN} и ${OTHER_BIN}`), null);
        assert.equal(extractBin("ИП Иванов, тел. 77001234567"), null);
    });
});

describe("evaluateInvoicePayment", () => {
    test("coupon client gets the bottles from the invoice", () => {
        const result = evaluateInvoicePayment({ invoice: invoice({ qty12: 5 }), amount: 30000, paymentMethod: "coupon" });
        assert.deepEqual(result, { ok: true, creditKind: "bottles", credited: { b19: 20, b12: 5, balance: 0 } });
    });

    test("coupon overpayment goes to the tenge balance", () => {
        const result = evaluateInvoicePayment({ invoice: invoice(), amount: 30500, paymentMethod: "coupon" });
        assert.deepEqual(result.credited, { b19: 20, b12: 0, balance: 500 });
    });

    test("balance client gets the whole paid amount in tenge", () => {
        const result = evaluateInvoicePayment({ invoice: invoice(), amount: 30500, paymentMethod: "balance" });
        assert.deepEqual(result, { ok: true, creditKind: "balance", credited: { b19: 0, b12: 0, balance: 30500 } });
    });

    test("underpayment is never credited", () => {
        const result = evaluateInvoicePayment({ invoice: invoice(), amount: 29999.99, paymentMethod: "coupon" });
        assert.equal(result.ok, false);
        assert.match(result.reason, /Недоплата/);
    });

    test("fakt client: review automatically, mark-only when a manager confirms", () => {
        assert.equal(evaluateInvoicePayment({ invoice: invoice(), amount: 30000, paymentMethod: "fakt" }).ok, false);
        assert.deepEqual(
            evaluateInvoicePayment({ invoice: invoice(), amount: 30000, paymentMethod: "fakt", allowFakt: true }),
            { ok: true, creditKind: "none", credited: { b19: 0, b12: 0, balance: 0 } }
        );
    });

    test("compares money in tiyn, not floats", () => {
        const result = evaluateInvoicePayment({ invoice: invoice({ total: 0.3 }), amount: 0.1 + 0.2, paymentMethod: "balance" });
        assert.equal(result.ok, true);
    });
});

describe("decideTransactionMatch", () => {
    const tx = { amount: 30000, payerBin: BIN };

    test("number in purpose + same BIN closes the invoice", () => {
        const open = invoice();
        const decision = decideTransactionMatch({ tx, invoicesByNumber: [open], openInvoicesOfPayer: [open], isKnownPayer: true });
        assert.deepEqual(decision, { action: MATCH_ACTIONS.APPLY, invoice: open });
    });

    test("number of someone else's invoice is not enough — needs review", () => {
        const foreign = invoice({ buyerBin: OTHER_BIN });
        const decision = decideTransactionMatch({ tx, invoicesByNumber: [foreign], openInvoicesOfPayer: [], isKnownPayer: true });
        assert.equal(decision.action, MATCH_ACTIONS.REVIEW);
    });

    test("an unknown payer with a coincidental number is ignored", () => {
        const foreign = invoice({ buyerBin: OTHER_BIN });
        const decision = decideTransactionMatch({ tx, invoicesByNumber: [foreign], openInvoicesOfPayer: [], isKnownPayer: false });
        assert.equal(decision.action, MATCH_ACTIONS.IGNORE);
    });

    test("paid invoice paid again goes to review, not credited twice", () => {
        const paid = invoice({ status: "paid" });
        const decision = decideTransactionMatch({ tx, invoicesByNumber: [paid], openInvoicesOfPayer: [], isKnownPayer: true });
        assert.equal(decision.action, MATCH_ACTIONS.REVIEW);
        assert.match(decision.reason, /уже оплачен/);
    });

    test("no number: the only open invoice of this BIN with the same amount", () => {
        const open = invoice();
        const decision = decideTransactionMatch({ tx, invoicesByNumber: [], openInvoicesOfPayer: [open, invoice({ _id: "inv2", number: "920", total: 15000 })], isKnownPayer: true });
        assert.deepEqual(decision, { action: MATCH_ACTIONS.APPLY, invoice: open });
    });

    test("no number and two open invoices with the same amount — review", () => {
        const decision = decideTransactionMatch({
            tx,
            invoicesByNumber: [],
            openInvoicesOfPayer: [invoice(), invoice({ _id: "inv2", number: "920" })],
            isKnownPayer: true,
        });
        assert.equal(decision.action, MATCH_ACTIONS.REVIEW);
    });

    test("invoice without buyer BIN is never closed automatically", () => {
        const noBin = invoice({ buyerBin: null });
        const decision = decideTransactionMatch({ tx, invoicesByNumber: [noBin], openInvoicesOfPayer: [], isKnownPayer: false });
        assert.equal(decision.action, MATCH_ACTIONS.REVIEW);
    });

    test("payment unrelated to invoices is ignored", () => {
        const decision = decideTransactionMatch({ tx, invoicesByNumber: [], openInvoicesOfPayer: [], isKnownPayer: false });
        assert.deepEqual(decision, { action: MATCH_ACTIONS.IGNORE });
    });
});
