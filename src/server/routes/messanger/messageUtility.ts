import { UserInterface } from "../../../mongoose";
import channelModel from "../../../mongoose/models/channel";

type ChannelFindByEitherChannelIdOrTargetIdParams = { user: UserInterface; channelId?: string; targetUserId?: string };
type ChannelFindByEitherChannelIdOrTargetIdResponse = {
    success: true,
    channelId: string;
} | {
    success: false,
    error: string;
    message?: string;
}

export async function findChannelByEitherChannelIdOrTargetId({ user, channelId, targetUserId }: ChannelFindByEitherChannelIdOrTargetIdParams): Promise<ChannelFindByEitherChannelIdOrTargetIdResponse> {
    const query = channelId ? { channelId } : { ownerUserIds: { $all: [user.userId, targetUserId] } };
    const channel = await channelModel.findOne(query);

    if (!channel) {
        if (!channelId) {
            // Wasn't looking for a specific channel, so we can just create one 
            try {
                const newChannel = await channelModel.create({ ownerUserIds: [user.userId, targetUserId] });
                return { success: true, channelId: newChannel.channelId };
            } catch (error) {
                return { success: false, error: "Internal Server Error", message: "Failed to create channel." };
            }
        } else {
            // Was looking for a specific channel but it doesn't exist
            return { success: false, error: "Channel Not Found", message: "The specified channel does not exist." };
        }
    }

    return { success: true, channelId: channel.channelId };
}