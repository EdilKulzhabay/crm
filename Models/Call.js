import mongoose from "mongoose";
import { CALL_STATUSES, END_REASONS, PARTICIPANT_TYPES } from "../calls/callConstants.js";

const ParticipantSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: Object.values(PARTICIPANT_TYPES),
            required: true,
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
    },
    { _id: false }
);

/** История VoIP-звонков между клиентом и курьером по заказу */
const CallSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },
        caller: {
            type: ParticipantSchema,
            required: true,
        },
        callee: {
            type: ParticipantSchema,
            required: true,
        },
        status: {
            type: String,
            enum: Object.values(CALL_STATUSES),
            default: CALL_STATUSES.RINGING,
        },
        acceptedAt: {
            type: Date,
            default: null,
        },
        endedAt: {
            type: Date,
            default: null,
        },
        durationSec: {
            type: Number,
            default: 0,
        },
        endReason: {
            type: String,
            enum: [...Object.values(END_REASONS), null],
            default: null,
        },
        endedBy: {
            type: String,
            enum: [...Object.values(PARTICIPANT_TYPES), null],
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

CallSchema.index({ order: 1, createdAt: -1 });
CallSchema.index({ "caller.id": 1, createdAt: -1 });
CallSchema.index({ "callee.id": 1, createdAt: -1 });
// Для восстановления после рестарта: поиск «зависших» активных звонков
CallSchema.index({ status: 1 });

export default mongoose.model("Call", CallSchema);
