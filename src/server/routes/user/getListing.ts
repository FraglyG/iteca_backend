import { z } from "zod";
import { userModel } from "../../../mongoose";
import listingModel from "../../../mongoose/models/listing";
import { getLogger } from "../../../util/logger";
import { TokenPayload } from "../../auth/jwt";
import { Route } from "../../package";

const logger = getLogger("ROUTE.GET_USER_LISTING");

new Route("GET:/api/user/listing").auth({ type: "JWT" }).onCall(async (req, res) => {
    const userPayload = req.user as TokenPayload;
    if (!userPayload) {
        logger.error("User payload not found in request");
        return res.status(401).json({ success: false, error: "Unauthorized", message: "User not authenticated" });
    }

    // Find listing
    const userListing = await listingModel.findOne({ ownerUserId: userPayload.userId });
    if (!userListing) {
        logger.error("User listing not found for userId:", userPayload.userId);
        return res.status(404).json({ success: false, error: "Not Found", message: "User listing not found" });
    }

    // Return listing
    res.json({ success: true, listing: userListing.toObject() });
});