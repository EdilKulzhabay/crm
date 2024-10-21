import mongoose from "mongoose";

const DepartmentSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
        },
        userName: {
            type: String,
            required: true,
        },
        password: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            default: "active",
        },
        receiving: {
            type: Boolean,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Department", DepartmentSchema);
