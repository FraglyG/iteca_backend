import { z } from "zod";
import { UserInterface, userModel } from "../../../mongoose";
import channelModel from "../../../mongoose/models/channel";
import messageModel from "../../../mongoose/models/message";
import { Route } from "../../package";

const channelQuerySchema = z.object({
    limit: z.number()
        .min(1, "Limit must be at least 1")
        .max(100, "Limit must be at most 100")
        .default(20),
});

new Route("GET:/api/message/channels").auth({ type: "JWT", config: { getFullUser: true } }).expectQuery(channelQuerySchema).onCall(async (req, res) => {
    const user = req.user as UserInterface;
    const { limit } = req.body as z.infer<typeof channelQuerySchema>;

    // Fetch channels for the user
    try {
        const channels = await channelModel.find({ ownerUserIds: user.userId }).sort({ createdAt: -1 }).limit(limit).lean();

        // Fetch latest messages for each channel
        const channelsWithLatestMessages = await Promise.all(channels.map(async (channel) => {
            const latestMessage = await messageModel.findOne({ channelId: channel.channelId }).sort({ createdAt: -1 }).lean();
            return { ...channel, latestMessage };
        }));

        // Fetch other users names in each channel
        const channelsWithUserNames = await Promise.all(channelsWithLatestMessages.map(async (channel) => {
            const otherUserIds = channel.ownerUserIds.filter(id => id !== user.userId);
            const otherUsers = await userModel.find({ userId: { $in: otherUserIds } }).select('userId username').lean();
            return { ...channel, otherUsers };
        }));

        const finalChannels = channelsWithUserNames;
        return res.status(200).json({ success: true, data: finalChannels });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Internal Server Error", message: "Failed to fetch channels." });
    }
});