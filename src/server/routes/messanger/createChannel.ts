import { z } from "zod";
import { UserInterface } from "../../../mongoose";
import messageModel from "../../../mongoose/models/message";
import { Route } from "../../package";
import { findChannelByEitherChannelIdOrTargetId } from "./messageUtility";
import channelModel from "../../../mongoose/models/channel";

const createChannelBodySchema = z.object({
    targetUserId: z.string()
        .min(1, "Target user ID is required")
        .max(50, "Target user ID cannot exceed 50 characters")
        .optional(),
});

new Route("POST:/api/message/channel/create").auth({ type: "JWT", config: { getFullUser: true } }).expectBody(createChannelBodySchema).onCall(async (req, res) => {
    const user = req.user as UserInterface;

    const { targetUserId } = req.body as z.infer<typeof createChannelBodySchema>;
    if (!targetUserId) return res.status(400).json({ success: false, error: "Invalid Request", message: "Either channelId or targetUserId must be provided." });

    // Validation
    if (targetUserId === user.userId) {
        return res.status(400).json({ success: false, error: "Invalid Request", message: "You cannot create a channel with yourself." });
    }

    // Find Channel
    const existingChannel = await channelModel.findOne({ ownerUserIds: { $all: [user.userId, targetUserId] } }).lean();
    if (existingChannel) return res.status(200).json({ success: true, message: "Channel already exists.", channel: existingChannel });

    // Create channel 
    try {
        const newChannel = await channelModel.create({
            ownerUserIds: [user.userId, targetUserId],
        });
        return res.status(201).json({ success: true, message: "Message sent successfully.", channel: newChannel.toObject() });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Internal Server Error", message: "Failed to send message." });
    }
})
