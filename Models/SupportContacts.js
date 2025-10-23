import mongoose from "mongoose";

const SupportContactsSchema = new mongoose.Schema(
    {
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
        },
        lastMessage: {
            type: String,
        },
        lastMessageTime: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("SupportContacts", SupportContactsSchema);