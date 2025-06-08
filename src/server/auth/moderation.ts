import cron from "node-schedule";
import { userModel } from "../../mongoose";
import { getLogger } from "../../util/logger";

const logger = getLogger("MOD.EXP");

class ModerationService {
    private static instance: ModerationService;

    private constructor() {
        this.startScheduledTasks();
    }

    /** Get singleton instance of ModerationService */
    static getInstance(): ModerationService {
        if (!ModerationService.instance) {
            ModerationService.instance = new ModerationService();
        }
        return ModerationService.instance;
    }

    /** Start all scheduled moderation tasks */
    private startScheduledTasks(): void {
        // Run auto-unban every 15 minutes
        cron.scheduleJob('*/15 * * * *', async () => {
            await this.processExpiredBans();
        });

        // Run auto-unmute every 15 minutes
        cron.scheduleJob('*/15 * * * *', async () => {
            await this.processExpiredMutes();
        });

        // Run auto-unban job listings every 15 minutes
        cron.scheduleJob('*/15 * * * *', async () => {
            await this.processExpiredJobListingBans();
        });

        logger.debug("Moderation scheduled tasks started - running every 15 minutes");
    }

    /** Process and unban users with expired bans */
    async processExpiredBans(): Promise<void> {
        try {
            const now = new Date();

            // Find users with expired bans
            const expiredBans = await userModel.find({
                'moderation.ban.isBanned': true,
                'moderation.ban.unbannedAt': { $lte: now, $ne: null }
            });

            if (expiredBans.length === 0) {
                logger.debug("No expired bans found");
                return;
            }

            // Update all expired bans
            const result = await userModel.updateMany(
                {
                    'moderation.ban.isBanned': true,
                    'moderation.ban.unbannedAt': { $lte: now, $ne: null }
                },
                {
                    $set: {
                        'moderation.ban.isBanned': false
                    }
                }
            );

            if (result.modifiedCount > 0) {
                logger.info(`Auto-unbanned ${result.modifiedCount} users with expired bans`);

                // Log individual unbans for audit purposes
                for (const user of expiredBans) {
                    logger.info(`Auto-unbanned user ${user.userId} - ban expired at ${user.moderation?.ban?.unbannedAt}`);
                }
            }

        } catch (error) {
            logger.error("Failed to process expired bans:", error);
        }
    }

    /** Process and unmute users with expired mutes */
    async processExpiredMutes(): Promise<void> {
        try {
            const now = new Date();

            // Find users with expired mutes
            const expiredMutes = await userModel.find({
                'moderation.muted.isMuted': true,
                'moderation.muted.unmutedAt': { $lte: now, $ne: null }
            });

            if (expiredMutes.length === 0) {
                logger.debug("No expired mutes found");
                return;
            }

            // Update all expired mutes
            const result = await userModel.updateMany(
                {
                    'moderation.muted.isMuted': true,
                    'moderation.muted.unmutedAt': { $lte: now, $ne: null }
                },
                {
                    $set: {
                        'moderation.muted.isMuted': false
                    }
                }
            );

            if (result.modifiedCount > 0) {
                logger.info(`Auto-unmuted ${result.modifiedCount} users with expired mutes`);

                // Log individual unmutes for audit purposes
                for (const user of expiredMutes) {
                    logger.info(`Auto-unmuted user ${user.userId} - mute expired at ${user.moderation?.muted?.unmutedAt}`);
                }
            }

        } catch (error) {
            logger.error("Failed to process expired mutes:", error);
        }
    }

    /** Process and unban users with expired job listing bans */
    async processExpiredJobListingBans(): Promise<void> {
        try {
            const now = new Date();

            // Find users with expired job listing bans
            const expiredJobBans = await userModel.find({
                'moderation.jobListingBan.isBanned': true,
                'moderation.jobListingBan.unbannedAt': { $lte: now, $ne: null }
            });

            if (expiredJobBans.length === 0) {
                logger.debug("No expired job listing bans found");
                return;
            }

            // Update all expired job listing bans
            const result = await userModel.updateMany(
                {
                    'moderation.jobListingBan.isBanned': true,
                    'moderation.jobListingBan.unbannedAt': { $lte: now, $ne: null }
                },
                {
                    $set: {
                        'moderation.jobListingBan.isBanned': false
                    }
                }
            );

            if (result.modifiedCount > 0) {
                logger.info(`Auto-unbanned ${result.modifiedCount} users from job listing with expired bans`);

                // Log individual unbans for audit purposes
                for (const user of expiredJobBans) {
                    logger.info(`Auto-unbanned user ${user.userId} from job listing - ban expired at ${user.moderation?.jobListingBan?.unbannedAt}`);
                }
            }

        } catch (error) {
            logger.error("Failed to process expired job listing bans:", error);
        }
    }

    /** Manually trigger processing of all expired moderation actions (Useful for testing or immediate cleanup) */
    async processAllExpired(): Promise<void> {
        logger.info("Manually processing all expired moderation actions");
        await Promise.all([
            this.processExpiredBans(),
            this.processExpiredMutes(),
            this.processExpiredJobListingBans()
        ]);
    }

    /** Get statistics about expired moderation actions that need processing */
    async getExpirationStats(): Promise<{
        expiredBans: number;
        expiredMutes: number;
        expiredJobListingBans: number;
    }> {
        try {
            const now = new Date();

            const [expiredBans, expiredMutes, expiredJobListingBans] = await Promise.all([
                userModel.countDocuments({
                    'moderation.ban.isBanned': true,
                    'moderation.ban.unbannedAt': { $lte: now, $ne: null }
                }),
                userModel.countDocuments({
                    'moderation.muted.isMuted': true,
                    'moderation.muted.unmutedAt': { $lte: now, $ne: null }
                }),
                userModel.countDocuments({
                    'moderation.jobListingBan.isBanned': true,
                    'moderation.jobListingBan.unbannedAt': { $lte: now, $ne: null }
                })
            ]);

            return {
                expiredBans,
                expiredMutes,
                expiredJobListingBans
            };
        } catch (error) {
            logger.error("Failed to get expiration stats:", error);
            return {
                expiredBans: 0,
                expiredMutes: 0,
                expiredJobListingBans: 0
            };
        }
    }
}

export const moderationService = ModerationService.getInstance();
