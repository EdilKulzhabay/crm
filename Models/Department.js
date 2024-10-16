import mongoose from "mongoose";
import moment from "moment-timezone";

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
        history: [
            {
                franchisee: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                type: {
                    type: Boolean
                },
                data: {
                    b121kol: {
                        type: Number,
                        default: 0
                    },
                    b191kol: {
                        type: Number,
                        default: 0
                    },
                    b197kol: {
                        type: Number,
                        default: 0
                    },
                },
                date: {
                    type: Date,
                    default: () => moment.tz("Asia/Almaty").toDate()
                }
            }
        ]
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Department", DepartmentSchema);
