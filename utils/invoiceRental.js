/**
 * Аренда возвратной тары в счёте юрлица.
 * Цена одна для всех организаций. В счёт пишется снимок цены, поэтому смена цены
 * здесь не меняет уже выставленные счета.
 * При оплате аренда только фиксируется в счёте: ни бутыли, ни баланс за неё не зачисляются.
 */
export const RENTAL_PRICES = Object.freeze({ rent19: 3500, rent12: 2500 });

export const RENTAL_ITEMS = Object.freeze({
    rent19: { name: "Аренда возвратной тары 18,9 л", unit: "шт." },
    rent12: { name: "Аренда возвратной тары 12,5 л", unit: "шт." },
});

/** Сумма аренды по снимку цен в счёте; у старых счетов без аренды — 0 */
export function invoiceRentalTotal(invoice) {
    const rent19 = Number(invoice?.rent19) || 0;
    const rent12 = Number(invoice?.rent12) || 0;
    const price19 = Number(invoice?.rentPrice19) || 0;
    const price12 = Number(invoice?.rentPrice12) || 0;
    return rent19 * price19 + rent12 * price12;
}
