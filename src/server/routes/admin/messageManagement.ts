import { z } from "zod";
import { Route } from "../../package";
import { userModel } from "../../../mongoose";
import channelModel from "../../../mongoose/models/channel";
import messageModel from "../../../mongoose/models/message";
import { getLogger } from "../../../util/logger";

const logger = getLogger("ADMIN.MESSAGE_MANAGEMENT");

// Get all channels with pagination
const getChannelsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(["asc", "desc"]).default("desc"),
});

new Route("GET:/api/admin/channels").auth({ type: "JWT" }).requireAdmin().expectQuery(getChannelsSchema).onCall(async (req, res) => {
    try {
        const { page, limit, sort } = req.body as z.infer<typeof getChannelsSchema>;

        const skip = (page - 1) * limit;

        // Fetch channels and total count
        const [channels, totalCount] = await Promise.all([
            channelModel.find({})
                .sort({ createdAt: sort === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            channelModel.countDocuments({})
        ]);

        // Get user data for channel participants
        const allUserIds = [...new Set(channels.flatMap(channel => channel.ownerUserIds))];
        const users = await userModel.find(
            { userId: { $in: allUserIds } },
            { userId: 1, username: 1, 'profile.firstName': 1, 'profile.lastName': 1 }
        ).lean();

        const userMap = new Map(users.map(user => [user.userId, user]));

        // Get message counts for each channel
        const channelIds = channels.map(channel => channel.channelId);
        const messageCounts = await Promise.all(
            channelIds.map(channelId =>
                messageModel.countDocuments({ channelId }).then(count => ({ channelId, count }))
            )
        );

        const messageCountMap = new Map(messageCounts.map(item => [item.channelId, item.count]));

        // Combine channels with user and message data
        const channelsWithData = channels.map(channel => ({
            ...channel,
            participants: channel.ownerUserIds.map(userId => userMap.get(userId)).filter(Boolean),
            messageCount: messageCountMap.get(channel.channelId) || 0
        }));

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            channels: channelsWithData,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        logger.error("Error fetching channels:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch channels"
        });
    }
});

// Get messages from a specific channel
const getChannelMessagesSchema = z.object({
    channelId: z.string().min(1),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    sort: z.enum(["asc", "desc"]).default("desc"),
});

new Route("POST:/api/admin/channels/messages").auth({ type: "JWT" }).requireAdmin().expectBody(getChannelMessagesSchema).onCall(async (req, res) => {
    try {
        const { channelId, page, limit, sort } = req.body as z.infer<typeof getChannelMessagesSchema>;

        // Check if channel exists
        const channel = await channelModel.findOne({ channelId }).lean();
        if (!channel) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "Channel not found"
            });
        }

        const skip = (page - 1) * limit;

        // Fetch messages and total count
        const [messages, totalCount] = await Promise.all([
            messageModel.find({ channelId })
                .sort({ createdAt: sort === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            messageModel.countDocuments({ channelId })
        ]);

        // Get user data for message senders
        const senderIds = [...new Set(messages.map(message => message.senderUserId))];
        const users = await userModel.find(
            { userId: { $in: senderIds } },
            { userId: 1, username: 1, 'profile.firstName': 1, 'profile.lastName': 1 }
        ).lean();

        const userMap = new Map(users.map(user => [user.userId, user]));

        // Get channel participants
        const participants = await userModel.find(
            { userId: { $in: channel.ownerUserIds } },
            { userId: 1, username: 1, 'profile.firstName': 1, 'profile.lastName': 1 }
        ).lean();

        // Combine messages with user data
        const messagesWithUsers = messages.map(message => ({
            ...message,
            sender: userMap.get(message.senderUserId) || null
        }));

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            channel: {
                ...channel,
                participants
            },
            messages: messagesWithUsers,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        logger.error("Error fetching channel messages:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch channel messages"
        });
    }
});

// Delete a specific message
const deleteMessageSchema = z.object({
    messageId: z.string().min(1),
});

new Route("DELETE:/api/admin/messages/delete").auth({ type: "JWT" }).requireAdmin().expectBody(deleteMessageSchema).onCall(async (req, res) => {
    try {
        const { messageId } = req.body as z.infer<typeof deleteMessageSchema>;

        const message = await messageModel.findOneAndDelete({ messageId });
        if (!message) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "Message not found"
            });
        }

        logger.info(`Admin deleted message ${messageId}`);
        res.json({
            success: true,
            message: "Message deleted successfully"
        });
    } catch (error) {
        logger.error("Error deleting message:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to delete message"
        });
    }
});

// Search messages across all channels
const searchMessagesSchema = z.object({
    query: z.string().min(1),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(["asc", "desc"]).default("desc"),
});

new Route("POST:/api/admin/messages/search").auth({ type: "JWT" }).requireAdmin().expectBody(searchMessagesSchema).onCall(async (req, res) => {
    try {
        const { query, page, limit, sort } = req.body as z.infer<typeof searchMessagesSchema>;

        const skip = (page - 1) * limit;
        const searchQuery = { content: { $regex: query, $options: 'i' } };

        const [messages, totalCount] = await Promise.all([
            messageModel.find(searchQuery)
                .sort({ createdAt: sort === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            messageModel.countDocuments(searchQuery)
        ]);

        // Get user data for message senders
        const senderIds = [...new Set(messages.map(message => message.senderUserId))];
        const users = await userModel.find(
            { userId: { $in: senderIds } },
            { userId: 1, username: 1, 'profile.firstName': 1, 'profile.lastName': 1 }
        ).lean();

        const userMap = new Map(users.map(user => [user.userId, user]));

        // Get channel data
        const channelIds = [...new Set(messages.map(message => message.channelId))];
        const channels = await channelModel.find(
            { channelId: { $in: channelIds } },
            { channelId: 1, ownerUserIds: 1 }
        ).lean();

        const channelMap = new Map(channels.map(channel => [channel.channelId, channel]));

        // Combine messages with user and channel data
        const messagesWithData = messages.map(message => ({
            ...message,
            sender: userMap.get(message.senderUserId) || null,
            channel: channelMap.get(message.channelId) || null
        }));

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            messages: messagesWithData,
            searchQuery: query,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        logger.error("Error searching messages:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to search messages"
        });
    }
});

// Search messages across all channels (GET version as documented)
const searchMessagesQuerySchema = z.object({
    query: z.string().min(1),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(["asc", "desc"]).default("desc"),
});

new Route("GET:/api/admin/messages/search").auth({ type: "JWT" }).requireAdmin().expectQuery(searchMessagesQuerySchema).onCall(async (req, res) => {
    try {
        const { query, page, limit, sort } = req.body as z.infer<typeof searchMessagesQuerySchema>;

        const skip = (page - 1) * limit;
        const searchQuery = { content: { $regex: query, $options: 'i' } };

        const [messages, totalCount] = await Promise.all([
            messageModel.find(searchQuery)
                .sort({ createdAt: sort === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            messageModel.countDocuments(searchQuery)
        ]);

        // Get user data for message senders
        const senderIds = [...new Set(messages.map(message => message.senderUserId))];
        const users = await userModel.find(
            { userId: { $in: senderIds } },
            { userId: 1, username: 1, 'profile.firstName': 1, 'profile.lastName': 1 }
        ).lean();

        const userMap = new Map(users.map(user => [user.userId, user]));

        // Get channel data
        const channelIds = [...new Set(messages.map(message => message.channelId))];
        const channels = await channelModel.find(
            { channelId: { $in: channelIds } },
            { channelId: 1, ownerUserIds: 1 }
        ).lean();

        const channelMap = new Map(channels.map(channel => [channel.channelId, channel]));

        // Combine messages with user and channel data
        const messagesWithData = messages.map(message => ({
            ...message,
            sender: userMap.get(message.senderUserId) || null,
            channel: channelMap.get(message.channelId) || null
        }));

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            messages: messagesWithData,
            searchQuery: query,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        logger.error("Error searching messages:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to search messages"
        });
    }
});

// Get messages by user across all channels
const getUserMessagesSchema = z.object({
    userId: z.string().min(1),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    sort: z.enum(["asc", "desc"]).default("desc"),
});

new Route("POST:/api/admin/messages/user").auth({ type: "JWT" }).requireAdmin().expectBody(getUserMessagesSchema).onCall(async (req, res) => {
    try {
        const { userId, page, limit, sort } = req.body as z.infer<typeof getUserMessagesSchema>;

        // Check if user exists
        const user = await userModel.findOne(
            { userId },
            { userId: 1, username: 1, 'profile.firstName': 1, 'profile.lastName': 1 }
        ).lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "User not found"
            });
        }

        const skip = (page - 1) * limit;

        // Fetch user's messages and total count
        const [messages, totalCount] = await Promise.all([
            messageModel.find({ senderUserId: userId })
                .sort({ createdAt: sort === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            messageModel.countDocuments({ senderUserId: userId })
        ]);

        // Get channel data
        const channelIds = [...new Set(messages.map(message => message.channelId))];
        const channels = await channelModel.find(
            { channelId: { $in: channelIds } },
            { channelId: 1, ownerUserIds: 1 }
        ).lean();

        const channelMap = new Map(channels.map(channel => [channel.channelId, channel]));

        // Combine messages with channel data
        const messagesWithChannels = messages.map(message => ({
            ...message,
            channel: channelMap.get(message.channelId) || null
        }));

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            user,
            messages: messagesWithChannels,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        logger.error("Error fetching user messages:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch user messages"
        });
    }
});

// Get all messages by all users across all channels
const getAllMessagesSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    sort: z.enum(["asc", "desc"]).default("desc"),
});

new Route("GET:/api/admin/messages").auth({ type: "JWT" }).requireAdmin().expectQuery(getAllMessagesSchema).onCall(async (req, res) => {
    try {
        const { page, limit, sort } = req.body as z.infer<typeof getAllMessagesSchema>;

        const skip = (page - 1) * limit;

        // Fetch all messages and total count
        const [messages, totalCount] = await Promise.all([
            messageModel.find({})
                .sort({ createdAt: sort === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            messageModel.countDocuments({})
        ]);

        // Get user data for message senders
        const senderIds = [...new Set(messages.map(message => message.senderUserId))];
        const users = await userModel.find(
            { userId: { $in: senderIds } },
            { userId: 1, username: 1, 'profile.firstName': 1, 'profile.lastName': 1 }
        ).lean();

        const userMap = new Map(users.map(user => [user.userId, user]));

        // Get channel data
        const channelIds = [...new Set(messages.map(message => message.channelId))];
        const channels = await channelModel.find(
            { channelId: { $in: channelIds } },
            { channelId: 1, ownerUserIds: 1 }
        ).lean();

        const channelMap = new Map(channels.map(channel => [channel.channelId, channel]));

        // Combine messages with user and channel data
        const messagesWithData = messages.map(message => ({
            ...message,
            sender: userMap.get(message.senderUserId) || null,
            channel: channelMap.get(message.channelId) || null
        }));

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            messages: messagesWithData,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        logger.error("Error fetching all messages:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch all messages"
        });
    }
});