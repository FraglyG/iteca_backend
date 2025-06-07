import { z } from "zod";
import { UserInterface } from "../../../mongoose";
import channelModel from "../../../mongoose/models/channel";
import messageModel from "../../../mongoose/models/message";
import userModel from "../../../mongoose/models/user";
import { Route } from "../../package";

const messageQuerySchema = z.object({
    limit: z.coerce.number()
        .min(1, "Limit must be at least 1")
        .max(100, "Limit must be at most 100")
        .default(20),
    channelId: z.string()
        .min(1, "Channel ID is required")
        .max(50, "Channel ID cannot exceed 50 characters"),
});

new Route("GET:/api/message/messages").auth({ type: "JWT", config: { getFullUser: true } }).expectQuery(messageQuerySchema).onCall(async (req, res) => {
    const user = req.user as UserInterface;
    const { limit, channelId } = req.body as z.infer<typeof messageQuerySchema>;

    // Find Channel
    const channel = await channelModel.findOne({ channelId, ownerUserIds: user.userId });
    if (!channel) return res.status(404).json({ success: false, error: "Channel Not Found", message: "The specified channel does not exist or you are not a member." });

    // Fetch messages
    try {
        const messages = await messageModel.find({ channelId }).sort({ createdAt: -1 }).limit(limit).lean();
        return res.status(200).json({ success: true, data: messages });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Internal Server Error", message: "Failed to fetch messages." });
    }
});