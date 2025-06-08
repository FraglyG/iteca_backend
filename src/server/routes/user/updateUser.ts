import { z } from "zod";
import { getLogger } from "../../../util/logger";
import { Route } from "../../package";
import { UserInterface, userModel } from "../../../mongoose";
import { TokenPayload } from "../../auth/jwt";

const logger = getLogger("ROUTE.UPDATE_USER");

const updateUserSchema = z.object({
    profile: z.object({
        bio: z.string().max(500, "Bio must be at most 500 characters long").optional(),
        firstName: z.string()
            .min(1, "First name is required").max(50, "First name must be at most 50 characters long")
            .regex(/^[a-zA-Z0-9_]+$/, "First name can only contain alphanumeric characters and underscores")
            .optional(),
        lastName: z.string()
            .min(1, "Last name is required").max(50, "Last name must be at most 50 characters long")
            .regex(/^[a-zA-Z0-9_]+$/, "Last name can only contain alphanumeric characters and underscores")
            .optional(),
        profilePicture: z.string().url().nullable().optional(),
    }).optional(),
});

new Route("POST:/api/user/update").auth({ type: "JWT", config: { getFullUser: false } }).expectBody(updateUserSchema).onCall(async (req, res) => {
    const userPayload = req.user as TokenPayload;
    if (!userPayload) {
        logger.warn("User not found in request");
        return res.status(401).json({ success: false, error: "Unauthorized", message: "User not authenticated." });
    }

    const user = await userModel.findOne({ userId: userPayload.userId });
    if (!user) {
        logger.warn(`User not found for userId: ${userPayload.userId}`);
        return res.status(404).json({ success: false, error: "Not Found", message: "User not found." });
    }

    const { profile } = req.body as z.infer<typeof updateUserSchema>;

    // Update user fields
    if (profile) {
        if (profile.bio !== undefined) user.profile.bio = profile.bio;
        if (profile.firstName) user.profile.firstName = profile.firstName.trim();
        if (profile.lastName) user.profile.lastName = profile.lastName.trim();

        if (profile.profilePicture) user.profile.profilePicture = profile.profilePicture;
        if (profile.profilePicture === null) user.profile.profilePicture = undefined;
        
        user.markModified('profile');
    }

    // Save user data
    try {
        await user.save();
        logger.info(`User ${user.userId} updated successfully`);
        return res.status(200).json({ success: true, user: user.toObject() });
    } catch (error) {
        logger.error(`Failed to update user ${user.userId}: ${error}`);
        return res.status(500).json({ success: false, error: "Internal Server Error", message: "Failed to update user." });
    }
});