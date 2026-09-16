import { sendDownloadClickEvent } from "../utils/metaConversionsApi.js";

const ALLOWED_EVENT_NAMES = new Set([
    "DownloadClickAndroid",
    "DownloadClickIOS",
]);

// Зеркало клиентского fbq('trackCustom', ...) с App-лендинга (AppLanding.js) —
// см. utils/metaConversionsApi.js#sendDownloadClickEvent.
export const trackDownload = async (req, res) => {
    try {
        const { eventName, eventId, fbp, fbc, sourceUrl } = req.body;

        if (!eventName || !eventId) {
            return res.status(400).json({
                success: false,
                message: "eventName и eventId обязательны",
            });
        }

        if (!ALLOWED_EVENT_NAMES.has(eventName)) {
            return res.status(400).json({
                success: false,
                message: "Недопустимое значение eventName",
            });
        }

        const result = await sendDownloadClickEvent({
            eventName,
            eventId,
            fbp,
            fbc,
            sourceUrl,
            req,
        });

        if (!result.ok) {
            return res.status(502).json({
                success: false,
                message: "Meta CAPI отклонил событие",
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};
