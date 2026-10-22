import cron from "node-cron";
import Client from "../Models/Client.js";
import { getTodayAlmaty } from "./dateUtils.js";
import { isHiddenFromPartner, loadClientsRhythm } from "./partnerClientActivity.js";
import { shortClientName } from "./partnerLedger.js";
import { sendPartnerPush } from "./partnerPush.js";

/** Раз в день утром по Алматы — партнёр успеет написать клиенту в тот же день */
const CHECK_CRON_EXPRESSION = "0 11 * * *";

const defaultDeps = {
    today: getTodayAlmaty,
    listPartnerClients: () =>
        Client.find({ referredByPartner: { $ne: null } })
            .select("_id userName referredByPartner partnerLapseNotifiedDay partnerHiddenOrderDay")
            .lean(),
    loadRhythm: loadClientsRhythm,
    markNotified: (clientId, day) => Client.updateOne({ _id: clientId }, { partnerLapseNotifiedDay: day }),
    notify: sendPartnerPush,
    logger: console,
};

/**
 * Находит клиентов партнёров, нарушивших свой ритм заказов, и уведомляет партнёра.
 * Одно уведомление на один перерыв: запоминаем день последнего заказа, за который уже уведомили;
 * после нового заказа клиент снова может «пропасть» и вызвать новое уведомление.
 */
export async function checkPartnerClientLapses(deps = defaultDeps) {
    const today = deps.today();
    const clients = await deps.listPartnerClients();
    const rhythms = await deps.loadRhythm(clients.map((client) => client._id), today);
    let notified = 0;

    for (const client of clients) {
        const rhythm = rhythms.get(String(client._id));
        if (!rhythm?.isLapsed || client.partnerLapseNotifiedDay === rhythm.lastOrderDay) continue;
        if (isHiddenFromPartner(client, rhythm)) continue;
        const name = shortClientName(client.userName);
        // Сначала отмечаем, потом шлём: сбой отправки не приведёт к повторным уведомлениям каждый день
        await deps.markNotified(client._id, rhythm.lastOrderDay);
        await deps.notify(client.referredByPartner, {
            title: "Клиент перестал заказывать",
            body: `${name} обычно заказывает воду раз в ${rhythm.intervalDays} дн., но не заказывал уже ${rhythm.daysSinceLast} дн. Напомните о себе.`,
            data: { type: "client_lapsed", clientId: String(client._id) },
        });
        notified += 1;
    }
    deps.logger.log(`[partnerLapseCheck] клиентов партнёров: ${clients.length}, уведомлений: ${notified}`);
    return notified;
}

let runningCheck = null;

/**
 * Запуск без параллельных копий (cron и кнопка в CRM): пока проверка идёт, второй вызов
 * получает тот же результат, а не рассылает уведомления повторно.
 * @returns {Promise<number>} сколько уведомлений отправлено
 */
export function runPartnerLapseCheck(deps = defaultDeps) {
    runningCheck ??= checkPartnerClientLapses(deps).finally(() => {
        runningCheck = null;
    });
    return runningCheck;
}

export function startPartnerLapseCheck() {
    cron.schedule(
        CHECK_CRON_EXPRESSION,
        () => {
            runPartnerLapseCheck().catch((error) =>
                console.error("[partnerLapseCheck] ошибка проверки:", error?.message || error)
            );
        },
        { timezone: "Asia/Almaty" }
    );
}
