import { z } from "zod";
import { UserInterface } from "../../../mongoose";
import { Route } from "../../package";
import channelModel from "../../../mongoose/models/channel";
import { getLogger } from "../../../util/logger";
import { SSEConnection, SSEMessage, sendSSEMessage, cleanupDeadConnections } from "./sseManager";
import { stime } from "../../../util/static";

const logger = getLogger("SSE.CHANNEL");

const channelSubscriptions = new Map<string, Set<SSEConnection>>();
const allChannelsSubscriptions = new Map<string, SSEConnection>();

const subscribeQuerySchema = z.object({
    channelId: z.string()
        .min(1, "Channel ID is required")
        .max(50, "Channel ID cannot exceed 50 characters"),
});

// SSE subscription endpoint
new Route("GET:/api/message/channel/subscribe").auth({ type: "JWT", config: { getFullUser: true } }).expectQuery(subscribeQuerySchema).onCall(async (req, res) => {
    const user = req.user as UserInterface;
    const { channelId } = req.body as z.infer<typeof subscribeQuerySchema>;

    // Verify user has access to this channel
    const channel = await channelModel.findOne({ channelId, ownerUserIds: user.userId });
    if (!channel) {
        return res.status(404).json({
            success: false,
            error: "Channel Not Found",
            message: "The specified channel does not exist or you are not a member."
        });
    }   
    
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    if (!channelSubscriptions.has(channelId)) channelSubscriptions.set(channelId, new Set());

    const subscription: SSEConnection = {
        res,
        userId: user.userId,
        connectedAt: new Date()
    };
    channelSubscriptions.get(channelId)!.add(subscription);

    sendSSEMessage(subscription, {
        type: 'connected',
        channelId,
        message: 'Connected to channel'
    });
    logger.debug(`User ${user.userId} subscribed to channel ${channelId}`);

    // Handle client disconnect
    const cleanup = () => {
        const channelSubs = channelSubscriptions.get(channelId);

        if (channelSubs) {
            channelSubs.delete(subscription);
            if (channelSubs.size === 0) channelSubscriptions.delete(channelId);
        }

        logger.debug(`User ${user.userId} unsubscribed from channel ${channelId}`);
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('close', cleanup);

    // Heartbeat
    const heartbeat = setInterval(() => {
        if (res.writableEnded) {
            clearInterval(heartbeat);
            cleanup();
            return;
        }
        sendSSEMessage(subscription, { type: 'heartbeat' });
    }, stime.minute * 0.5);

    req.on('close', () => clearInterval(heartbeat));
});

// SSE subscription endpoint for all channels
new Route("GET:/api/message/subscribe").auth({ type: "JWT", config: { getFullUser: true } }).onCall(async (req, res) => {
    const user = req.user as UserInterface;

    const userChannels = await channelModel.find({ ownerUserIds: user.userId });
    if (userChannels.length === 0) {
        return res.status(404).json({
            success: false,
            error: "No Channels Found",
            message: "You are not a member of any channels."
        });
    }
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const subscription: SSEConnection = {
        res,
        userId: user.userId,
        connectedAt: new Date()
    };

    allChannelsSubscriptions.set(user.userId, subscription);

    userChannels.forEach(channel => {
        if (!channelSubscriptions.has(channel.channelId)) {
            channelSubscriptions.set(channel.channelId, new Set());
        }
        channelSubscriptions.get(channel.channelId)!.add(subscription);
    });

    sendSSEMessage(subscription, {
        type: 'connected',
        message: 'Connected to all channels',
        data: {
            channels: userChannels.map(ch => ch.channelId),
            channelCount: userChannels.length
        }
    });

    logger.debug(`User ${user.userId} subscribed to all channels (${userChannels.length} channels)`);

    // Handle client disconnect
    const cleanup = () => {
        allChannelsSubscriptions.delete(user.userId);

        userChannels.forEach(channel => {
            const channelSubs = channelSubscriptions.get(channel.channelId);
            if (channelSubs) {
                channelSubs.delete(subscription);
                if (channelSubs.size === 0) {
                    channelSubscriptions.delete(channel.channelId);
                }
            }
        });

        logger.debug(`User ${user.userId} unsubscribed from all channels`);
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('close', cleanup);

    // Heartbeat
    const heartbeat = setInterval(() => {
        if (res.writableEnded) {
            clearInterval(heartbeat);
            cleanup();
            return;
        }
        sendSSEMessage(subscription, { type: 'heartbeat' });
    }, stime.minute * 0.5);

    req.on('close', () => clearInterval(heartbeat));
});

/** broadcast message to all subscribers of a channel */
export function broadcastMessageToChannel(channelId: string, message: any) {
    const channelSubs = channelSubscriptions.get(channelId);
    if (!channelSubs || channelSubs.size === 0) {
        logger.debug(`No subscribers for channel ${channelId}`);
        return;
    }

    const sseMessage: SSEMessage = {
        type: 'message',
        data: message,
        channelId
    };

    const toRemove: SSEConnection[] = [];

    channelSubs.forEach((connection) => {
        const success = sendSSEMessage(connection, sseMessage);
        if (!success) toRemove.push(connection);
        else logger.debug(`Message broadcasted to user ${connection.userId} in channel ${channelId}`);
    });

    // Remove failed connections
    toRemove.forEach(sub => channelSubs.delete(sub));
    if (channelSubs.size === 0) channelSubscriptions.delete(channelId);
}

/** get all users subscribed to all channels  */
export function getAllChannelsSubscribers(): Map<string, SSEConnection> {
    return allChannelsSubscriptions;
}

/** check if a user is subscribed to all channels  */
export function isUserSubscribedToAllChannels(userId: string): boolean {
    return allChannelsSubscriptions.has(userId);
}

export { channelSubscriptions, allChannelsSubscriptions };
