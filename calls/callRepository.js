import mongoose from "mongoose";
import Call from "../Models/Call.js";
import Order from "../Models/Order.js";
import { ACTIVE_CALL_STATUSES, CALL_STATUSES, END_REASONS } from "./callConstants.js";

/** @typedef {import("./callPolicy.js").CallOrder} CallOrder */
/** @typedef {import("./callPolicy.js").Participant} Participant */

export const isValidObjectId = (value) => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);

/**
 * @param {string} orderId
 * @returns {Promise<CallOrder | null>}
 */
const findOrderForCall = async (orderId) => {
    const order = await Order.findById(orderId)
        .select("status client courierAggregator deliveredTime")
        .populate("client", "fullName")
        .populate("courierAggregator", "fullName")
        .lean();

    if (!order) return null;

    return {
        id: order._id.toString(),
        status: order.status,
        clientId: order.client?._id?.toString() ?? null,
        courierId: order.courierAggregator?._id?.toString() ?? null,
        deliveredTime: order.deliveredTime ?? null,
        clientName: order.client?.fullName || "Клиент",
        courierName: order.courierAggregator?.fullName || "Курьер",
    };
};

const newCallId = () => new mongoose.Types.ObjectId().toString();

/**
 * @param {{ id: string, orderId: string, caller: Participant, callee: Participant }} call
 */
const createCall = async ({ id, orderId, caller, callee }) => {
    await Call.create({ _id: id, order: orderId, caller, callee, status: CALL_STATUSES.RINGING });
};

/**
 * @param {string} callId
 * @param {Record<string, unknown>} fields
 */
const updateCall = async (callId, fields) => {
    await Call.updateOne({ _id: callId }, { $set: fields });
};

/**
 * Живое состояние звонков хранится в памяти процесса, поэтому после рестарта
 * все активные в БД звонки заведомо оборваны.
 * @param {Date} now
 * @returns {Promise<number>}
 */
const failStaleActiveCalls = async (now) => {
    const result = await Call.updateMany(
        { status: { $in: ACTIVE_CALL_STATUSES } },
        { $set: { status: CALL_STATUSES.FAILED, endReason: END_REASONS.SERVER_RESTART, endedAt: now } }
    );
    return result.modifiedCount;
};

export const mongoCallRepository = Object.freeze({
    findOrderForCall,
    newCallId,
    createCall,
    updateCall,
    failStaleActiveCalls,
});
