import { z } from "zod";
import { UserInterface } from "../../../mongoose";
import { Route } from "../../package";
import channelModel from "../../../mongoose/models/channel";
import messageModel from "../../../mongoose/models/message";
import { findChannelByEitherChannelIdOrTargetId } from "./messageUtility";

const messageBodySchema = z.object({
    content: z.string()
        .min(1, "Message content cannot be empty")
        .max(500, "Message content cannot exceed 500 characters"),
    channelId: z.string()
        .min(1, "Channel ID is required")
        .max(50, "Channel ID cannot exceed 50 characters")
        .optional(),
    targetUserId: z.string()
        .min(1, "Target user ID is required")
        .max(50, "Target user ID cannot exceed 50 characters")
        .optional(),
});

new Route("POST:/api/message/send").auth({ type: "JWT", config: { getFullUser: true } }).expectBody(messageBodySchema).onCall(async (req, res) => {
    const user = req.user as UserInterface;

    const { content, channelId, targetUserId } = req.body as z.infer<typeof messageBodySchema>;
    if (!channelId && !targetUserId) return res.status(400).json({ success: false, error: "Invalid Request", message: "Either channelId or targetUserId must be provided." });

    // Find Channel
    const channelSearchResult = await findChannelByEitherChannelIdOrTargetId({ user, channelId, targetUserId });
    if (!channelSearchResult.success) return res.json(channelSearchResult);

    // Create message 
    try {
        const newMessage = await messageModel.create({
            channelId: channelSearchResult.channelId,
            senderUserId: user.userId,
            content: content.trim(),
        });
        return res.status(201).json({ success: true, message: "Message sent successfully.", data: newMessage });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Internal Server Error", message: "Failed to send message." });
    }
})
