// import { z } from "zod";
// import { getLogger } from "../../../util/logger";
// import { Route } from "../../package";
// import { access } from "fs";
// import { validateJWT } from "../../auth/util";
// import { userModel } from "../../../mongoose";
// import { TokenPayload } from "../../auth/jwt";
// import listingModel, { ListingInterface } from "../../../mongoose/models/listing";
// import { Document } from "mongoose";

// const logger = getLogger("ROUTE.UPDATE_LISTING");

// new Route("GET:/api/user/from/jwt").auth({ type: "JWT", config: { getFullUser: true } }).onCall(async (req, res) => {
//     res.json(req.user);
// });

// const setListingSchema = z.object({
//     listingId: z.string().uuid().optional(),
//     thumbnailUrl: z.string().optional(),
//     shortDescription: z.string().optional()
// });

// new Route("POST:/api/listing/set").expectBody(setListingSchema).auth({ type: "JWT" }).onCall(async (req, res) => {
//     const userPayload = req.user as TokenPayload;

//     const user = await userModel.findOne({ userId: userPayload.userId });
//     if (!user) {
//         logger.error("User not found for userId:", userPayload.userId);
//         return res.status(404).json({ error: "User not found" });
//     }

//     const { listingId, thumbnailUrl, shortDescription } = req.body as z.infer<typeof setListingSchema>;

//     let listing: ListingInterface & Document;
//     if (listingId) {
//         // Find existing listing by ID
//         const existingListing = await listingModel.findOne({ listingId });
//         if (!existingListing) {
//             logger.error("Listing not found for listingId:", listingId);
//             return res.status(404).json({ error: "Listing not found" });
//         } else {
//             listing = existingListing;
//         }
//     } else {
//         // Create a new listing
//         listing = new listingModel({
//             ownerUserId: user.userId,
//             thumbnailUrl,
//             shortDescription
//         });
//     }
// });