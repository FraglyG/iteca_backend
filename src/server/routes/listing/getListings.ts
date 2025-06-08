import { z } from "zod";
import { userModel } from "../../../mongoose";
import listingModel from "../../../mongoose/models/listing";
import { getLogger } from "../../../util/logger";
import { TokenPayload } from "../../auth/jwt";
import { Route } from "../../package";

const logger = getLogger("ROUTE.GET_LISTINGS");

const querySchema = z.object({
    page: z.coerce.number().int({ message: "Page must be an integer" })
        .min(1, { message: "Page must be at least 1" })
        .default(1),
    limit: z.coerce.number().int({ message: "Limit must be an integer" })
        .min(1, { message: "Limit must be at least 1" })
        .max(100, { message: "Limit cannot exceed 100" })
        .default(10),
    sort: z.enum(["asc", "desc"], {
        errorMap: () => ({ message: "Sort must be either 'asc' or 'desc'" })
    }).default("desc"),
    sortBy: z.enum(["createdAt", "updatedAt", "price"], {
        errorMap: () => ({ message: "SortBy must be one of: 'createdAt', 'updatedAt', or 'price'" })
    }).default("createdAt"),
    search: z.string({ invalid_type_error: "Search must be a string" }).optional(),
    category: z.string({ invalid_type_error: "Category must be a string" }).optional(),
});

new Route("GET:/api/listings/get").expectQuery(querySchema).onCall(async (req, res) => {
    const userPayload = req.user as TokenPayload;

    try {
        const { page, limit, sort, sortBy, search, category } = req.body as z.infer<typeof querySchema>;

        logger.debug(`Fetching listings according to: ${JSON.stringify({ page, limit, sort, sortBy, search, category })}`);

        const query: any = {};
        if (search) query.$or = [{ shortDescription: { $regex: search, $options: 'i' } }];

        // if (category) {
        //     // TODO: Implement the category field later
        //     // Update: I never got time to implement this lmao
        //     query.category = category;
        // }

        const skip = (page - 1) * limit;

        // Build sort object
        const sortObj: any = {};
        sortObj[sortBy] = sort === "asc" ? 1 : -1;

        // Fetch listings and total count
        const [listings, totalCount] = await Promise.all([
            listingModel.find(query).sort(sortObj).skip(skip).limit(limit).lean(),
            listingModel.countDocuments(query)
        ]);

        const userIds = [...new Set(listings.map(listing => listing.ownerUserId))];
        const users = await userModel.find(
            { userId: { $in: userIds } },
            { passwordHash: 0, emailVerification: 0, primaryEmail: 0 } // Exclude sensitive fields
        ).lean();
        const userMap = new Map(users.map(user => [user.userId, user]));

        // Remove listings where owner is listing-banned
        const listingsWithUsers = listings
            .map(listing => ({ ...listing, owner: userMap.get(listing.ownerUserId) || null }))
            .filter(listing => !(listing.owner && listing.owner.moderation?.jobListingBan?.isBanned));

        // Pagination meta
        const filteredTotalCount = listingsWithUsers.length;
        const totalPages = Math.ceil(filteredTotalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        logger.debug(`Retrieved ${listingsWithUsers.length} listings with user data`);

        // Return the response
        res.json({
            success: true,
            data: {
                listings: listingsWithUsers,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount: filteredTotalCount,
                    hasNextPage,
                    hasPrevPage,
                    limit
                }
            }
        });

    } catch (error) {
        logger.error(`Error fetching listings for user ${userPayload.userId}:`, error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch listings"
        });
    }
});