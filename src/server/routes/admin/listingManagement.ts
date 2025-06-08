import { z } from "zod";
import { Route } from "../../package";
import { userModel } from "../../../mongoose";
import listingModel from "../../../mongoose/models/listing";
import { getLogger } from "../../../util/logger";

const logger = getLogger("ADMIN.LISTING_MANAGEMENT");

// Get all listings with pagination and search
const getListingsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    sort: z.enum(["asc", "desc"]).default("desc"),
    sortBy: z.enum(["createdAt", "updatedAt", "shortDescription"]).default("createdAt"),
});

new Route("GET:/api/admin/listings").auth({ type: "JWT" }).requireAdmin().expectQuery(getListingsSchema).onCall(async (req, res) => {
    try {
        const { page, limit, search, sort, sortBy } = req.body as z.infer<typeof getListingsSchema>;

        // Build search query
        const query: any = {};
        if (search) query.shortDescription = { $regex: search, $options: 'i' };
        const skip = (page - 1) * limit;
        const sortObj: any = {};
        sortObj[sortBy] = sort === "asc" ? 1 : -1;

        // Fetch listings and total count
        const [listings, totalCount] = await Promise.all([
            listingModel.find(query).sort(sortObj).skip(skip).limit(limit).lean(),
            listingModel.countDocuments(query)
        ]);

        // Get user data for listings
        const userIds = [...new Set(listings.map(listing => listing.ownerUserId))];
        const users = await userModel.find(
            { userId: { $in: userIds } },
            { userId: 1, username: 1, primaryEmail: 1, 'profile.firstName': 1, 'profile.lastName': 1 }
        ).lean();

        const userMap = new Map(users.map(user => [user.userId, user]));

        // Combine listings with user data
        const listingsWithUsers = listings.map(listing => ({
            ...listing,
            owner: userMap.get(listing.ownerUserId) || null
        }));

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            listings: listingsWithUsers,
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
        logger.error("Error fetching listings:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch listings"
        });
    }
});

// Get specific listing details
const getListingByIdSchema = z.object({
    listingId: z.string().min(1),
});

new Route("POST:/api/admin/listings/get").auth({ type: "JWT" }).requireAdmin().expectBody(getListingByIdSchema).onCall(async (req, res) => {
    try {
        const { listingId } = req.body as z.infer<typeof getListingByIdSchema>;

        const listing = await listingModel.findOne({ listingId }).lean();
        if (!listing) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "Listing not found"
            });
        }

        // Get owner details
        const owner = await userModel.findOne(
            { userId: listing.ownerUserId },
            { passwordHash: 0, emailVerification: 0 }
        ).lean();

        res.json({
            success: true,
            listing: {
                ...listing,
                owner
            }
        });
    } catch (error) {
        logger.error("Error fetching listing:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch listing"
        });
    }
});

// Update listing
const updateListingSchema = z.object({
    listingId: z.string().min(1),
    thumbnailUrl: z.string().url().optional(),
    shortDescription: z.string().min(1).max(200).optional(),
});

new Route("PUT:/api/admin/listings/update").auth({ type: "JWT" }).requireAdmin().expectBody(updateListingSchema).onCall(async (req, res) => {
    try {
        const { listingId, ...updateData } = req.body as z.infer<typeof updateListingSchema>;

        const listing = await listingModel.findOne({ listingId });
        if (!listing) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "Listing not found"
            });
        }

        // Update listing fields
        if (updateData.thumbnailUrl !== undefined) listing.thumbnailUrl = updateData.thumbnailUrl;
        if (updateData.shortDescription !== undefined) listing.shortDescription = updateData.shortDescription;

        await listing.save();

        logger.info(`Admin updated listing ${listingId}`);
        res.json({
            success: true,
            message: "Listing updated successfully",
            listing: listing.toObject()
        });
    } catch (error) {
        logger.error("Error updating listing:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to update listing"
        });
    }
});

// Delete listing
const deleteListingSchema = z.object({
    listingId: z.string().min(1),
});

new Route("DELETE:/api/admin/listings/delete").auth({ type: "JWT" }).requireAdmin().expectBody(deleteListingSchema).onCall(async (req, res) => {
    try {
        const { listingId } = req.body as z.infer<typeof deleteListingSchema>;

        const listing = await listingModel.findOneAndDelete({ listingId });
        if (!listing) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "Listing not found"
            });
        }

        logger.info(`Admin deleted listing ${listingId}`);
        res.json({
            success: true,
            message: "Listing deleted successfully"
        });
    } catch (error) {
        logger.error("Error deleting listing:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to delete listing"
        });
    }
});

// Get listings by user
const getListingsByUserSchema = z.object({
    userId: z.string().min(1),
});

new Route("POST:/api/admin/listings/user").auth({ type: "JWT" }).requireAdmin().expectBody(getListingsByUserSchema).onCall(async (req, res) => {
    try {
        const { userId } = req.body as z.infer<typeof getListingsByUserSchema>;

        // Check if user exists
        const user = await userModel.findOne(
            { userId },
            { userId: 1, username: 1, primaryEmail: 1, 'profile.firstName': 1, 'profile.lastName': 1 }
        ).lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "User not found"
            });
        }

        // Get user's listings
        const listings = await listingModel.find({ ownerUserId: userId }).lean();

        res.json({
            success: true,
            user,
            listings
        });
    } catch (error) {
        logger.error("Error fetching user listings:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch user listings"
        });
    }
});
