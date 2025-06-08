import { z } from "zod";
import { Route } from "../../package";
import { userModel, UserInterface } from "../../../mongoose";
import { getLogger } from "../../../util/logger";

const logger = getLogger("ADMIN.USER_MANAGEMENT");

// Get all users with pagination and search
const getUsersSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    sort: z.enum(["asc", "desc"]).default("desc"),
    sortBy: z.enum(["createdAt", "updatedAt", "username", "primaryEmail"]).default("createdAt"),
});

new Route("GET:/api/admin/users").auth({ type: "JWT" }).requireAdmin().expectQuery(getUsersSchema).onCall(async (req, res) => {
    try {
        const { page, limit, search, sort, sortBy } = req.body as z.infer<typeof getUsersSchema>;

        // Build search query
        const query: any = {};
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { primaryEmail: { $regex: search, $options: 'i' } },
                { 'profile.firstName': { $regex: search, $options: 'i' } },
                { 'profile.lastName': { $regex: search, $options: 'i' } }
            ];
        }
        const skip = (page - 1) * limit;
        const sortObj: any = {};
        sortObj[sortBy] = sort === "asc" ? 1 : -1;

        // Fetch users and total count
        const [users, totalCount] = await Promise.all([
            userModel.find(query, { passwordHash: 0 })
                .sort(sortObj)
                .skip(skip)
                .limit(limit)
                .lean(),
            userModel.countDocuments(query)
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            users,
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
        logger.error("Error fetching users:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch users"
        });
    }
});

// Get specific user details
const getUserByIdSchema = z.object({
    userId: z.string().min(1),
});

new Route("POST:/api/admin/users/get").auth({ type: "JWT" }).requireAdmin().expectBody(getUserByIdSchema).onCall(async (req, res) => {
    try {
        const { userId } = req.body as z.infer<typeof getUserByIdSchema>;

        const user = await userModel.findOne({ userId }, { passwordHash: 0 }).lean();
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        logger.error("Error fetching user:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch user"
        });
    }
});

// Update user details
const updateUserSchema = z.object({
    userId: z.string().min(1),
    username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/).optional(),
    primaryEmail: z.string().email().optional(),
    emailVerified: z.boolean().optional(),
    profile: z.object({
        bio: z.string().max(500).optional(),
        firstName: z.string().min(1).max(50).optional(),
        lastName: z.string().min(1).max(50).optional(),
        profilePicture: z.string().url().nullable().optional(),
    }).optional(),
});

new Route("PUT:/api/admin/users/update").auth({ type: "JWT" }).requireAdmin().expectBody(updateUserSchema).onCall(async (req, res) => {
    try {
        const { userId, ...updateData } = req.body as z.infer<typeof updateUserSchema>;

        // Check if user exists
        const user = await userModel.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "User not found"
            });
        }

        // Update user fields
        if (updateData.username !== undefined) user.username = updateData.username;
        if (updateData.primaryEmail !== undefined) user.primaryEmail = updateData.primaryEmail;
        if (updateData.emailVerified !== undefined) user.emailVerified = updateData.emailVerified;

        if (updateData.profile) {
            if (updateData.profile.bio !== undefined) user.profile.bio = updateData.profile.bio;
            if (updateData.profile.firstName !== undefined) user.profile.firstName = updateData.profile.firstName;
            if (updateData.profile.lastName !== undefined) user.profile.lastName = updateData.profile.lastName;
            if (updateData.profile.profilePicture !== undefined) user.profile.profilePicture = updateData.profile.profilePicture || undefined;
            user.markModified('profile');
        }

        await user.save();

        logger.info(`Admin updated user ${userId}`);
        res.json({
            success: true,
            message: "User updated successfully",
            user: user.toObject()
        });
    } catch (error) {
        logger.error("Error updating user:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to update user"
        });
    }
});

// Delete user
const deleteUserSchema = z.object({
    userId: z.string().min(1),
});

new Route("DELETE:/api/admin/users/delete").auth({ type: "JWT" }).requireAdmin().expectBody(deleteUserSchema).onCall(async (req, res) => {
    try {
        const { userId } = req.body as z.infer<typeof deleteUserSchema>;

        const user = await userModel.findOneAndDelete({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "User not found"
            });
        }

        logger.info(`Admin deleted user ${userId}`);
        res.json({
            success: true,
            message: "User deleted successfully"
        });
    } catch (error) {
        logger.error("Error deleting user:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to delete user"
        });
    }
});
