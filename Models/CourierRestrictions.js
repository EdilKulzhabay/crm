import mongoose from "mongoose";

const CourierRestrictionsModel = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
    },
    courierId: {
        type: String,
        required: true,
    },
});

export default mongoose.model("CourierRestrictions", CourierRestrictionsModel);
