import { getLogger } from "../../../util/logger";

const logger = getLogger("SSE.MANAGER");

export interface SSEConnection {
    res: any;
    userId: string;
    connectedAt: Date;
}

export interface SSEMessage {
    type: 'message' | 'connected' | 'heartbeat' | 'user_joined' | 'user_left' | 'error';
    data?: any;
    channelId?: string;
    message?: string;
    timestamp?: Date;
}

/** Send an SSE message to a specific connection */
export function sendSSEMessage(connection: SSEConnection, message: SSEMessage): boolean {
    try {
        if (connection.res.writableEnded) {
            return false;
        }

        const messageWithTimestamp = {
            ...message,
            timestamp: new Date()
        };

        connection.res.write(`data: ${JSON.stringify(messageWithTimestamp)}\n\n`);
        return true;
    } catch (error) {
        logger.error(`Failed to send SSE message to user ${connection.userId}:`, error);
        return false;
    }
}

/** Get connection count for a specific channel */
export function getChannelConnectionCount(channelSubscriptions: Map<string, Set<SSEConnection>>, channelId: string): number {
    const connections = channelSubscriptions.get(channelId);
    return connections ? connections.size : 0;
}

/** Get all connected user IDs for a specific channel */
export function getChannelConnectedUsers(channelSubscriptions: Map<string, Set<SSEConnection>>, channelId: string): string[] {
    const connections = channelSubscriptions.get(channelId);
    if (!connections) return [];

    return Array.from(connections).map(conn => conn.userId);
}

/** Cleanup dead connections from a channel */
export function cleanupDeadConnections(channelSubscriptions: Map<string, Set<SSEConnection>>, channelId: string): number {
    const connections = channelSubscriptions.get(channelId);
    if (!connections) return 0;

    let removedCount = 0;
    const toRemove: SSEConnection[] = [];

    connections.forEach(connection => {
        if (connection.res.writableEnded) toRemove.push(connection);
    });

    toRemove.forEach(conn => {
        connections.delete(conn);
        removedCount++;
    });

    if (connections.size === 0) channelSubscriptions.delete(channelId);
    if (removedCount > 0) logger.debug(`Cleaned up ${removedCount} dead connections from channel ${channelId}`);

    return removedCount;
}
