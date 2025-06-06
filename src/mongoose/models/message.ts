import { model, Schema } from "mongoose";
import { getKey } from "../util/id";

// INTERFACE
export interface MessageInterface {
    /** ID of the message */
    messageId: string;
    /** ID of the channel this message belongs to */
    channelId: string;
    /** ID of the user who sent this message */
    senderUserId: string;
    /** The content of the message */
    content: string;
}

// SCHEMA
const messageSchema = new Schema<MessageInterface>({
    /** ID of the message */
    messageId: { type: String, default: () => getKey("message") },
    /** ID of the channel this message belongs to */
    channelId: { type: String, required: true },
    /** ID of the user who sent this message */
    senderUserId: { type: String, required: true },
    /** The content of the message */
    content: { type: String, required: true },
}, { timestamps: true })

// INDEXES
messageSchema.index({ messageId: 1 }, { unique: true });
messageSchema.index({ channelId: 1 });
messageSchema.index({ senderUserId: 1 });

// CREATE MODEL
export const messageModel = model<MessageInterface>('Message', messageSchema);
export default messageModel;