import mongoose from "mongoose";

/**
 * Журнал ручных изменений баланса и оплаченных талонов клиента через CRM.
 * Фиксирует кто внёс изменение, зачем, когда и что именно было изменено.
 */
const ClientOperationLogSchema = new mongoose.Schema(
    {
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            required: true,
            index: true,
        },
        field: {
            type: String,
            required: true,
        },
        oldValue: {
            type: mongoose.Schema.Types.Mixed,
        },
        newValue: {
            type: mongoose.Schema.Types.Mixed,
        },
        changedBy: {
            type: String,
            required: true,
        },
        reason: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("ClientOperationLog", ClientOperationLogSchema);
