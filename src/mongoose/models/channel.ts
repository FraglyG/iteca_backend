import { model, Schema } from "mongoose";
import { getKey } from "../util/id";

// INTERFACE
export interface ChannelInterface {
    /** ID of the channel */
    channelId: string;
    /** Array of participants in this channel */
    ownerUserIds: string[];
}

// SCHEMA
const channelSchema = new Schema<ChannelInterface>({
    channelId: { type: String, default: () => getKey("channel") },
    ownerUserIds: { type: [String], required: true }
}, { timestamps: true })

// INDEXES
channelSchema.index({ channelId: 1 }, { unique: true });
channelSchema.index({ ownerUserIds: 1 });

// CREATE MODEL
export const channelModel = model<ChannelInterface>('Channel', channelSchema);
export default channelModel;