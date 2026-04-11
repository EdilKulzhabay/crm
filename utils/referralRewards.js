import Client from "../Models/Client.js";
import Order from "../Models/Order.js";

const REFERRER_BONUS = 1000;

function isReferrerBonusAlreadyPaidForInvitee(client) {
    if (!client) {
        return true;
    }
    return (
        client.firstOrderReferrerBonusPaid === true ||
        client.referralReferrerBonusPaid === true
    );
}

/**
 * После доставки: бонус пригласившему за ЭТОГО клиента (приглашённого), один раз на приглашённого.
 * У пригласившего неограниченное число друзей — у каждого приглашённого свой документ и своё поле firstOrderReferrerBonusPaid.
 */
export async function applyReferrerBonusOnFirstDeliveredOrder(orderClientId) {
    try {
        const clientId = orderClientId?.toString?.() || orderClientId;
        const client = await Client.findById(clientId).select(
            "referredBy firstOrderReferrerBonusPaid referralReferrerBonusPaid"
        );
        if (!client?.referredBy || isReferrerBonusAlreadyPaidForInvitee(client)) {
            return;
        }

        const deliveredCount = await Order.countDocuments({
            client: clientId,
            status: "delivered",
        });
        if (deliveredCount !== 1) {
            return;
        }

        await Client.findByIdAndUpdate(client.referredBy, {
            $inc: { balance: REFERRER_BONUS },
        });
        await Client.findByIdAndUpdate(clientId, {
            $set: { firstOrderReferrerBonusPaid: true },
            $unset: { referralReferrerBonusPaid: "" },
        });
    } catch (e) {
        console.error("applyReferrerBonusOnFirstDeliveredOrder:", e);
    }
}
