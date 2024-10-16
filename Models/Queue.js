import mongoose from "mongoose";

const QueueSchema = new mongoose.Schema({
    franchisee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }
});

export default mongoose.model("Queue", QueueSchema);