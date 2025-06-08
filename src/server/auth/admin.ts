import { Request, Response, NextFunction } from "express";
import { getLogger } from "../../util/logger";
import CONFIG from "../../util/config";
import { TokenPayload } from "./jwt";
import { UserInterface } from "../../mongoose";

const logger = getLogger("ADMIN_AUTH");

/**
 * Middleware to check if the authenticated user is an admin
 * This middleware should be used after the JWT authentication middleware
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const user = req.user as TokenPayload | UserInterface;
    
    if (!user) {
        logger.warn("Admin middleware called without user authentication");
        return res.status(401).json({ 
            success: false, 
            error: "Unauthorized", 
            message: "Authentication required" 
        });
    }

    const userId = user.userId;
    
    // Check if user is in the admin list
    if (!CONFIG.moderation.adminUserIds.includes(userId)) {
        logger.warn(`Non-admin user ${userId} attempted to access admin endpoint`);
        return res.status(403).json({ 
            success: false, 
            error: "Forbidden", 
            message: "Admin privileges required" 
        });
    }

    logger.debug(`Admin user ${userId} accessing admin endpoint`);
    next();
}

/**
 * Check if a user ID is an admin
 */
export function isAdmin(userId: string): boolean {
    return CONFIG.moderation.adminUserIds.includes(userId);
}
