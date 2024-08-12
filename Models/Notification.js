import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
    {
        first: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        second: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        matchedField: {
            type: String,
            reqiured: true,
        },
        matchesType: {
            type: String,
            reqiured: true,
        },
        firstObject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
        },
        secondObject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
        },
        notes: {
            type: String,
            default: "",
        },
        status: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Notification", NotificationSchema);
