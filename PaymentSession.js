import mongoose from "mongoose";

const PaymentSessionSchema = new mongoose.Schema(
    {
        orderId: { type: String, required: true, unique: true },
        clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
        amount: { type: Number, required: true },
        currency: { type: String, default: "KZT" },
        status: { type: String, default: "pending", enum: ["pending", "success", "fail"] },
        coInvId: { type: String },
    },
    { timestamps: true }
);

export default mongoose.model("PaymentSession", PaymentSessionSchema);
