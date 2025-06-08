import { z } from "zod";
import { Route } from "../../package";
import { userModel } from "../../../mongoose";
import { getLogger } from "../../../util/logger";

const logger = getLogger("ADMIN.MODERATION");

// Ban user
const banUserSchema = z.object({
    userId: z.string().min(1),
    banReason: z.string().min(1).max(500),
    duration: z.number().positive().optional(), // Duration in hours, if not provided it's permanent
});

new Route("POST:/api/admin/moderation/ban").auth({ type: "JWT" }).requireAdmin().expectBody(banUserSchema).onCall(async (req, res) => {
        try {
            const { userId, banReason, duration } = req.body as z.infer<typeof banUserSchema>;

            const user = await userModel.findOne({ userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: "Not Found",
                    message: "User not found"
                });
            }

            // Init moderation object
            if (!user.moderation) user.moderation = {};
            if (!user.moderation.ban) user.moderation.ban = {};

            // Set ban details
            user.moderation.ban.isBanned = true;
            user.moderation.ban.bannedAt = new Date();
            user.moderation.ban.banReason = banReason;

            // If duration is specified, set unban date
            if (duration) user.moderation.ban.unbannedAt = new Date(Date.now() + duration * 60 * 60 * 1000);
            else user.moderation.ban.unbannedAt = undefined;

            user.markModified('moderation');
            await user.save();

            logger.info(`Admin banned user ${userId} for: ${banReason}`);
            res.json({
                success: true,
                message: `User banned successfully${duration ? ` for ${duration} hours` : ' permanently'}`,
                ban: user.moderation.ban
            });
        } catch (error) {
            logger.error("Error banning user:", error);
            res.status(500).json({
                success: false,
                error: "Internal Server Error",
                message: "Failed to ban user"
            });
        }
    });

// Unban user
const unbanUserSchema = z.object({
    userId: z.string().min(1),
});

new Route("POST:/api/admin/moderation/unban").auth({ type: "JWT" }).requireAdmin().expectBody(unbanUserSchema).onCall(async (req, res) => {
        try {
            const { userId } = req.body as z.infer<typeof unbanUserSchema>;

            const user = await userModel.findOne({ userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: "Not Found",
                    message: "User not found"
                });
            }

            if (!user.moderation?.ban?.isBanned) {
                return res.status(400).json({
                    success: false,
                    error: "Bad Request",
                    message: "User is not currently banned"
                });
            }

            // Unban user
            user.moderation.ban.isBanned = false;
            user.moderation.ban.unbannedAt = new Date();
            user.markModified('moderation');
            await user.save();

            logger.info(`Admin unbanned user ${userId}`);
            res.json({
                success: true,
                message: "User unbanned successfully"
            });
        } catch (error) {
            logger.error("Error unbanning user:", error);
            res.status(500).json({
                success: false,
                error: "Internal Server Error",
                message: "Failed to unban user"
            });
        }
    });

// Mute user
const muteUserSchema = z.object({
    userId: z.string().min(1),
    muteReason: z.string().min(1).max(500),
    duration: z.number().positive().optional(), // Duration in hours, if not provided it's permanent
});

new Route("POST:/api/admin/moderation/mute").auth({ type: "JWT" }).requireAdmin().expectBody(muteUserSchema).onCall(async (req, res) => {
        try {
            const { userId, muteReason, duration } = req.body as z.infer<typeof muteUserSchema>;

            const user = await userModel.findOne({ userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: "Not Found",
                    message: "User not found"
                });
            }

            // Init mod object
            if (!user.moderation) user.moderation = {};
            if (!user.moderation.muted) user.moderation.muted = {};

            // Set mute details
            user.moderation.muted.isMuted = true;
            user.moderation.muted.mutedAt = new Date();
            user.moderation.muted.muteReason = muteReason;

            // If duration is specified, set unmute date
            if (duration) user.moderation.muted.unmutedAt = new Date(Date.now() + duration * 60 * 60 * 1000);
            else user.moderation.muted.unmutedAt = undefined;

            user.markModified('moderation');
            await user.save();

            logger.info(`Admin muted user ${userId} for: ${muteReason}`);
            res.json({
                success: true,
                message: `User muted successfully${duration ? ` for ${duration} hours` : ' permanently'}`,
                mute: user.moderation.muted
            });
        } catch (error) {
            logger.error("Error muting user:", error);
            res.status(500).json({
                success: false,
                error: "Internal Server Error",
                message: "Failed to mute user"
            });
        }
    });

// Unmute user
const unmuteUserSchema = z.object({
    userId: z.string().min(1),
});

new Route("POST:/api/admin/moderation/unmute").auth({ type: "JWT" }).requireAdmin().expectBody(unmuteUserSchema).onCall(async (req, res) => {
        try {
            const { userId } = req.body as z.infer<typeof unmuteUserSchema>;

            const user = await userModel.findOne({ userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: "Not Found",
                    message: "User not found"
                });
            }

            if (!user.moderation?.muted?.isMuted) {
                return res.status(400).json({
                    success: false,
                    error: "Bad Request",
                    message: "User is not currently muted"
                });
            }

            // Unmute user
            user.moderation.muted.isMuted = false;
            user.moderation.muted.unmutedAt = new Date();
            user.markModified('moderation');
            await user.save();

            logger.info(`Admin unmuted user ${userId}`);
            res.json({
                success: true,
                message: "User unmuted successfully"
            });
        } catch (error) {
            logger.error("Error unmuting user:", error);
            res.status(500).json({
                success: false,
                error: "Internal Server Error",
                message: "Failed to unmute user"
            });
        }
    });

// Job listing ban
const jobListingBanSchema = z.object({
    userId: z.string().min(1),
    banReason: z.string().min(1).max(500),
    duration: z.number().positive().optional(), // Duration in hours, if not provided it's permanent
});

new Route("POST:/api/admin/moderation/job-listing-ban").auth({ type: "JWT" }).requireAdmin().expectBody(jobListingBanSchema).onCall(async (req, res) => {
        try {
            const { userId, banReason, duration } = req.body as z.infer<typeof jobListingBanSchema>;

            const user = await userModel.findOne({ userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: "Not Found",
                    message: "User not found"
                });
            }

            // Init mod object
            if (!user.moderation) user.moderation = {};
            if (!user.moderation.jobListingBan) user.moderation.jobListingBan = {};

            // Set job listing ban details
            user.moderation.jobListingBan.isBanned = true;
            user.moderation.jobListingBan.bannedAt = new Date();
            user.moderation.jobListingBan.banReason = banReason;

            // If duration is specified, set unban date
            if (duration) user.moderation.jobListingBan.unbannedAt = new Date(Date.now() + duration * 60 * 60 * 1000);
            else user.moderation.jobListingBan.unbannedAt = undefined;

            user.markModified('moderation');
            await user.save();

            logger.info(`Admin job listing banned user ${userId} for: ${banReason}`);
            res.json({
                success: true,
                message: `User job listing banned successfully${duration ? ` for ${duration} hours` : ' permanently'}`,
                jobListingBan: user.moderation.jobListingBan
            });
        } catch (error) {
            logger.error("Error job listing banning user:", error);
            res.status(500).json({
                success: false,
                error: "Internal Server Error",
                message: "Failed to job listing ban user"
            });
        }
    });

// Remove job listing ban
const jobListingUnbanSchema = z.object({
    userId: z.string().min(1),
});

new Route("POST:/api/admin/moderation/job-listing-unban").auth({ type: "JWT" }).requireAdmin().expectBody(jobListingUnbanSchema).onCall(async (req, res) => {
        try {
            const { userId } = req.body as z.infer<typeof jobListingUnbanSchema>;

            const user = await userModel.findOne({ userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: "Not Found",
                    message: "User not found"
                });
            }

            if (!user.moderation?.jobListingBan?.isBanned) {
                return res.status(400).json({
                    success: false,
                    error: "Bad Request",
                    message: "User is not currently job listing banned"
                });
            }

            // Remove job listing ban
            user.moderation.jobListingBan.isBanned = false;
            user.moderation.jobListingBan.unbannedAt = new Date();
            user.markModified('moderation');
            await user.save();

            logger.info(`Admin removed job listing ban for user ${userId}`);
            res.json({
                success: true,
                message: "User job listing ban removed successfully"
            });
        } catch (error) {
            logger.error("Error removing job listing ban:", error);
            res.status(500).json({
                success: false,
                error: "Internal Server Error",
                message: "Failed to remove job listing ban"
            });
        }
    });

// Get moderation history for a user
const getModerationHistorySchema = z.object({
    userId: z.string().min(1),
});

new Route("POST:/api/admin/moderation/history").auth({ type: "JWT" }).requireAdmin().expectBody(getModerationHistorySchema).onCall(async (req, res) => {
        try {
            const { userId } = req.body as z.infer<typeof getModerationHistorySchema>;

            const user = await userModel.findOne({ userId }, {
                moderation: 1,
                username: 1,
                primaryEmail: 1,
                'profile.firstName': 1,
                'profile.lastName': 1
            }).lean();

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: "Not Found",
                    message: "User not found"
                });
            }

            res.json({
                success: true,
                user: {
                    userId: user.userId,
                    username: user.username,
                    primaryEmail: user.primaryEmail,
                    profile: user.profile
                },
                moderation: user.moderation || {}
            });
        } catch (error) {
            logger.error("Error fetching moderation history:", error);
            res.status(500).json({
                success: false,
                error: "Internal Server Error",
                message: "Failed to fetch moderation history"
            });
        }
    });
