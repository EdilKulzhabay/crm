import mongoose from "mongoose";

const ClientSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        mail: {
            type: String,
            required: true,
        },
        addresses: [
            {
                street: {
                    type: String,
                    required: true,
                },
                link: {
                    type: String,
                    required: true,
                },
                house: {
                    type: String,
                    required: true,
                },
            },
        ],
        price19: {
            type: String,
            required: true,
        },
        price12: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            default: "active",
        },
        franchisee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Client", ClientSchema);
