import { model, Schema } from "mongoose";
import { getKey } from "../util/id";

// INTERFACE
export interface ListingInterface {
    /** UUID for this listing */
    listingId: string;
    /** The user who created this listing */
    ownerUserId: string;

    /** Listing thumbnail */
    thumbnailUrl?: string;
    /** Listing slogan */
    shortDescription?: string;
}

// SCHEMA
const listingSchema = new Schema<ListingInterface>({
    listingId: { type: String, default: () => getKey("listing") },
    ownerUserId: { type: String, required: true },

    // Content
    thumbnailUrl: { type: String },
    shortDescription: { type: String }
}, { timestamps: true })

// INDEXES
listingSchema.index({ listingId: 1 }, { unique: true });
listingSchema.index({ ownerUserId: 1 });

// CREATE MODEL
export const listingModel = model<ListingInterface>('Listing', listingSchema);
export default listingModel;