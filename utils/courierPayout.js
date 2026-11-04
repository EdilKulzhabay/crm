/**
 * Тариф курьера-агрегатора за доставленную бутыль.
 * При доставке тариф фиксируется в заказе (Order.courierPayoutRates), чтобы смена тарифа
 * в CRM меняла заработок только по будущим заказам, а не пересчитывала уже доставленные.
 */

const DEFAULT_PRICE12 = 300;
const DEFAULT_PRICE19 = 500;

/**
 * Текущий тариф курьера (для новых заказов).
 * @param {{ price12?: number, price19?: number } | null | undefined} courier
 * @returns {{ price12: number, price19: number }}
 */
export function getCourierPayoutRates(courier) {
    return {
        price12: courier?.price12 || DEFAULT_PRICE12,
        price19: courier?.price19 || DEFAULT_PRICE19,
    };
}

/**
 * Тариф, по которому считается уже доставленный заказ: зафиксированный при доставке,
 * а для старых заказов без снимка — текущий тариф курьера.
 * @param {{ courierPayoutRates?: { price12?: number, price19?: number } } | null | undefined} order
 * @param {{ price12?: number, price19?: number } | null | undefined} courier
 */
export function getOrderPayoutRates(order, courier) {
    const snapshot = order?.courierPayoutRates;
    const current = getCourierPayoutRates(courier);
    return {
        price12: Number.isFinite(snapshot?.price12) ? snapshot.price12 : current.price12,
        price19: Number.isFinite(snapshot?.price19) ? snapshot.price19 : current.price19,
    };
}

/**
 * Заработок за бутыли по заказу.
 * @param {{ b12?: number, b19?: number } | null | undefined} products
 * @param {{ price12: number, price19: number }} rates
 */
export function calculateBottleEarnings(products, rates) {
    const b12 = Number(products?.b12) || 0;
    const b19 = Number(products?.b19) || 0;
    return b12 * rates.price12 + b19 * rates.price19;
}
