import moment from "moment-timezone";
import mongoose from "mongoose";

const DepartmentHistorySchema = new mongoose.Schema(
    {
        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department",
            required: true,
        },
        franchisee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        type: {
            type: Boolean,
        },
        data: {
            b121kol: {
                type: Number,
                default: 0,
            },
            b191kol: {
                type: Number,
                default: 0,
            },
            b197kol: {
                type: Number,
                default: 0,
            },
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("DepartmentHistory", DepartmentHistorySchema);
