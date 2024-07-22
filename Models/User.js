import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: true,
        },
        fullName: {
            type: String,
            required: true,
        },
        password: {
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
        role: {
            type: String,
            required: true,
            default: "client",
        },
        status: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("User", UserSchema);
