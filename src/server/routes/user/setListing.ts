import { z } from "zod";
import { userModel } from "../../../mongoose";
import listingModel from "../../../mongoose/models/listing";
import { getLogger } from "../../../util/logger";
import { TokenPayload } from "../../auth/jwt";
import { Route } from "../../package";

const logger = getLogger("ROUTE.UPDATE_USER_LISTING");

const setListingSchema = z.object({
    thumbnailUrl: z.string({
        invalid_type_error: "Thumbnail URL must be a string"
    }).url({ message: "Invalid thumbnail URL format" }).optional(),
    shortDescription: z.string({
        required_error: "Short description is required",
        invalid_type_error: "Short description must be a string"
    }).min(1, { message: "Short description cannot be empty" })
        .max(200, { message: "Short description cannot exceed 200 characters" })
});

new Route("POST:/api/user/listing/update").expectBody(setListingSchema).auth({ type: "JWT" }).onCall(async (req, res) => {
    const userPayload = req.user as TokenPayload;

    const user = await userModel.findOne({ userId: userPayload.userId });
    if (!user) {
        logger.error("User not found for userId:", userPayload.userId);
        return res.status(404).json({ error: "User not found" });
    }

    const { thumbnailUrl, shortDescription } = req.body as z.infer<typeof setListingSchema>;

    let userListing = await listingModel.findOne({ ownerUserId: user.userId });
    if (!userListing) {
        // Create a new listing if it doesn't exist
        const newListing = new listingModel({
            ownerUserId: user.userId,
            thumbnailUrl,
            shortDescription
        });
        await newListing.save();
        userListing = newListing;
    }

    if (!userListing) {
        logger.error("Failed to create or find listing for userId:", user.userId);
        return res.status(500).json({ error: "Failed to create or find listing" });
    }

    // Update the existing listing
    if (thumbnailUrl) userListing.thumbnailUrl = thumbnailUrl;
    if (shortDescription) userListing.shortDescription = shortDescription;

    // Save
    await userListing.save();
    res.json({ success: true, listing: userListing.toObject() });
});