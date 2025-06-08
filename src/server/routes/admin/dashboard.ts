import { z } from "zod";
import { Route } from "../../package";
import { userModel } from "../../../mongoose";
import listingModel from "../../../mongoose/models/listing";
import channelModel from "../../../mongoose/models/channel";
import messageModel from "../../../mongoose/models/message";
import { getLogger } from "../../../util/logger";
import pidusage from "pidusage";

const logger = getLogger("ADMIN.DASHBOARD");

// Get dashboard overview statistics
new Route("GET:/api/admin/dashboard/overview").auth({ type: "JWT" }).requireAdmin().onCall(async (req, res) => {
    try {
        // Get total counts
        const [
            totalUsers,
            totalListings,
            totalChannels,
            totalMessages,
            verifiedUsers,
            bannedUsers,
            mutedUsers,
            jobListingBannedUsers,
            recentUsers,
            recentListings,
            recentMessages
        ] = await Promise.all([
            // Total counts
            userModel.countDocuments({}),
            listingModel.countDocuments({}),
            channelModel.countDocuments({}),
            messageModel.countDocuments({}),

            // User moderation stats
            userModel.countDocuments({ emailVerified: true }),
            userModel.countDocuments({ 'moderation.ban.isBanned': true }),
            userModel.countDocuments({ 'moderation.muted.isMuted': true }),
            userModel.countDocuments({ 'moderation.jobListingBan.isBanned': true }),

            // Recent activity (last 7 days)
            userModel.countDocuments({
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }),
            listingModel.countDocuments({
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }),
            messageModel.countDocuments({
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }),
        ]);

        // Get user growth data for the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const userGrowth = await userModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
            }
        ]);

        // Get top users by message count
        const topMessageSenders = await messageModel.aggregate([
            {
                $group: {
                    _id: "$senderUserId",
                    messageCount: { $sum: 1 }
                }
            },
            {
                $sort: { messageCount: -1 }
            },
            {
                $limit: 10
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "userId",
                    as: "user"
                }
            },
            {
                $unwind: "$user"
            },
            {
                $project: {
                    messageCount: 1,
                    user: {
                        userId: "$user.userId",
                        username: "$user.username",
                        "profile.firstName": "$user.profile.firstName",
                        "profile.lastName": "$user.profile.lastName"
                    }
                }
            }
        ]);

        // Get recent flagged/moderated users
        const moderatedUsers = await userModel.find({
            $or: [
                { 'moderation.ban.isBanned': true },
                { 'moderation.muted.isMuted': true },
                { 'moderation.jobListingBan.isBanned': true }
            ]
        }, {
            userId: 1,
            username: 1,
            'profile.firstName': 1,
            'profile.lastName': 1,
            'moderation': 1
        }).sort({ updatedAt: -1 }).limit(10).lean();

        res.json({
            success: true,
            dashboard: {
                totals: {
                    users: totalUsers,
                    listings: totalListings,
                    channels: totalChannels,
                    messages: totalMessages
                },
                userStats: {
                    verified: verifiedUsers,
                    banned: bannedUsers,
                    muted: mutedUsers,
                    jobListingBanned: jobListingBannedUsers,
                    unverified: totalUsers - verifiedUsers
                },
                recentActivity: {
                    newUsers: recentUsers,
                    newListings: recentListings,
                    newMessages: recentMessages
                },
                userGrowth,
                topMessageSenders,
                recentModerations: moderatedUsers
            }
        });
    } catch (error) {
        logger.error("Error fetching dashboard overview:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch dashboard overview"
        });
    }
});

// Get system health status
new Route("GET:/api/admin/dashboard/health").auth({ type: "JWT" }).requireAdmin().onCall(async (req, res) => {
    try {
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();

        // Check database connectivity
        const dbHealthCheck = await userModel.findOne({}).lean().catch(() => null);
        const dbStatus = dbHealthCheck !== null ? 'healthy' : 'unhealthy';

        res.json({
            success: true,
            health: {
                uptime: {
                    seconds: uptime,
                    formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
                },
                memory: {
                    rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
                    external: Math.round(memoryUsage.external / 1024 / 1024), // MB
                },
                database: {
                    status: dbStatus,
                    connected: dbStatus === 'healthy'
                },
                nodeVersion: process.version,
                environment: process.env.NODE_ENV || 'development'
            }
        });
    } catch (error) {
        logger.error("Error fetching system health:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch system health"
        });
    }
});

// Get user growth data
const getUserGrowthSchema = z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
});

new Route("GET:/api/admin/dashboard/user-growth").auth({ type: "JWT" }).requireAdmin().expectQuery(getUserGrowthSchema).onCall(async (req, res) => {
    try {
        const { days } = req.body as z.infer<typeof getUserGrowthSchema>;

        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Get user growth data for the specified period
        const userGrowth = await userModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
            }
        ]);

        // Fill in missing days with 0 counts
        const dailyGrowth = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            const existingData = userGrowth.find(item =>
                item._id.year === date.getFullYear() &&
                item._id.month === date.getMonth() + 1 &&
                item._id.day === date.getDate()
            );

            dailyGrowth.push({
                date: date.toISOString().split('T')[0],
                count: existingData ? existingData.count : 0
            });
        }

        res.json({
            success: true,
            userGrowth: dailyGrowth,
            period: `${days} days`,
            totalNewUsers: dailyGrowth.reduce((sum, day) => sum + day.count, 0)
        });
    } catch (error) {
        logger.error("Error fetching user growth data:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch user growth data"
        });
    }
});

// Get system health status (extended version)
new Route("GET:/api/admin/dashboard/system-health").auth({ type: "JWT" }).requireAdmin().onCall(async (req, res) => {
    try {
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();

        // Check database connectivity with response time
        const dbStart = Date.now();
        const dbHealthCheck = await userModel.findOne({}).lean().catch(() => null);
        const dbResponseTime = Date.now() - dbStart;
        const dbStatus = dbHealthCheck !== null ? 'connected' : 'disconnected';

        // Get CPU and memory usage using pidusage
        const pidStats = await pidusage(process.pid);

        res.json({
            success: true,
            systemHealth: {
                database: {
                    status: dbStatus,
                    responseTime: dbResponseTime
                },
                server: {
                    uptime: uptime,
                    memoryUsage: {
                        rss: memoryUsage.rss,
                        heapTotal: memoryUsage.heapTotal,
                        heapUsed: memoryUsage.heapUsed,
                        external: memoryUsage.external,
                        pidusageMemory: pidStats.memory
                    },
                    cpuUsage: parseFloat(pidStats.cpu.toFixed(2)) // %
                },
                nodeVersion: process.version,
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error("Error fetching system health:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: "Failed to fetch system health"
        });
    }
});
