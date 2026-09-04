import MobileAppSettings from "../Models/MobileAppSettings.js";

/** Актуальная версия мобильного клиента, настраиваемая суперадмином в CRM. */
export async function getLatestAppVersionValue() {
    const doc = await MobileAppSettings.findOne();
    return (doc?.latestAppVersion || "").trim();
}
