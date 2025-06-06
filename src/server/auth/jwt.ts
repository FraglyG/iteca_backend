import { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { RefreshToken, UserInterface } from '../../mongoose';
import cron from "node-schedule";
import { getLogger } from '../../util/logger';
import CONFIG from '../../util/config';

const logger = getLogger('JWT');

// Cookie configuration
const baseCookieOptions: CookieOptions = {
    httpOnly: true,
    secure: CONFIG.nodeEnv === 'production',
    sameSite: 'lax',
    domain: `.${CONFIG.domain.base}`,
};

export const tokenCookieOptions = {
    accessToken: {
        ...baseCookieOptions,
        maxAge: CONFIG.jwt.accessTokenExpiry,
    } as CookieOptions,
    refreshToken: {
        ...baseCookieOptions,
        maxAge: CONFIG.jwt.refreshTokenExpiry,
    } as CookieOptions
};

export interface TokenPayload {
    /** The unique identifier of the user */
    userId: string;
    /** The timestamp when the token expires */
    expires?: number; // has to be optional cause authentication via API doesn't have expires info since it only maps user to UserToken

    exp?: number;
    iat?: number;
}


declare module 'express' {
    interface Request {
        user: TokenPayload;
    }
}

/**
 * Service handling JWT token generation, verification, and management.
 * Implements singleton pattern to ensure single instance across the application.
 */
class JWTService {
    private static instance: JWTService;
    private constructor() { }

    /**
     * Gets the singleton instance of JWTService
     * @returns {JWTService} The singleton instance
     */
    static getInstance(): JWTService {
        if (!JWTService.instance) {
            JWTService.instance = new JWTService();
        }
        return JWTService.instance;
    }

    createPayloadFromUser(user: UserInterface): Omit<TokenPayload, "expires"> {
        return {
            userId: user.userId,
        };
    }

    /**
     * Generates both access and refresh tokens for a user
     * @param {Omit<TokenPayload, "expires">} user - User data to encode in the token
     * @returns {Promise<{accessToken: string, refreshToken: string}>} Generated token pair
     * @throws {Error} If token generation fails
     */
    async generateTokens(user: Omit<TokenPayload, "expires">): Promise<{ accessToken: string; refreshToken: string }> {
        try {
            const payload: TokenPayload = {
                ...user,
                expires: Date.now() + CONFIG.jwt.accessTokenExpiry
            };

            const accessToken = jwt.sign(payload, CONFIG.jwt.secret, {
                expiresIn: CONFIG.jwt.accessTokenExpiry / 1000,
                algorithm: 'HS256'
            });

            const refreshToken = jwt.sign(payload, CONFIG.jwt.refreshSecret, {
                expiresIn: CONFIG.jwt.refreshTokenExpiry / 1000,
                algorithm: 'HS256'
            });

            await this.storeRefreshToken(
                user.userId,
                refreshToken,
                new Date(Date.now() + CONFIG.jwt.refreshTokenExpiry)
            );

            logger.debug(`Generated tokens for user ${user.userId}`);
            return { accessToken, refreshToken };
        } catch (error) {
            logger.error('Token generation failed:', error);
            throw new Error('Failed to generate tokens');
        }
    }

    /**
     * Verifies the validity of an access token
     * @param {string} token - The access token to verify
     * @returns {TokenPayload | null} Decoded token payload or null if invalid
     */
    verifyAccessToken(token: string): TokenPayload | null {
        try {
            return jwt.verify(token, CONFIG.jwt.secret) as TokenPayload;
        } catch (error) {
            logger.debug(`Access token verification failed: ${error}`);
            return null;
        }
    }

    /**
     * Verifies the validity of a refresh token and checks if it's been revoked
     * @param {string} token - The refresh token to verify
     * @returns {Promise<TokenPayload | null>} Decoded token payload or null if invalid/revoked
     */
    async verifyRefreshToken(token: string): Promise<TokenPayload | null> {
        try {
            if (await this.isTokenRevoked(token)) {
                logger.debug('Refresh token has been revoked');
                return null;
            }
            return jwt.verify(token, CONFIG.jwt.refreshSecret) as TokenPayload;
        } catch (error) {
            logger.debug(`Refresh token verification failed: ${error}`);
            return null;
        }
    }

    /**
     * Generates a new access token using a valid refresh token
     * @param {string} refreshToken - The refresh token to use
     * @returns {Promise<{accessToken: string, payload: TokenPayload} | null>} New access token and payload or null if refresh failed
     */
    async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; payload: TokenPayload } | null> {
        try {
            const oldPayload = await this.verifyRefreshToken(refreshToken);
            if (!oldPayload) return null;

            const { exp, iat, ...cleanPayload } = oldPayload;
            const payload: TokenPayload = {
                ...cleanPayload,
                expires: Date.now() + CONFIG.jwt.accessTokenExpiry
            };

            const accessToken = jwt.sign(payload, CONFIG.jwt.secret, {
                expiresIn: CONFIG.jwt.accessTokenExpiry / 1000
            });

            return { accessToken, payload };
        } catch (error) {
            logger.error('Failed to refresh access token:', error);
            return null;
        }
    }

    /**
     * Stores a refresh token in the database
     * @param {string} userId - The user ID associated with the token
     * @param {string} token - The refresh token to store
     * @param {Date} expiresAt - Token expiration date
     */
    async storeRefreshToken(userId: string, token: string, expiresAt: Date): Promise<void> {
        await RefreshToken.create({ userId, token, expiresAt });
    }

    /**
     * Revokes a refresh token making it invalid for future use
     * @param {string} userId - The user ID associated with the token
     * @param {string} token - The refresh token to revoke
     */
    async revokeRefreshToken(userId: string, token: string): Promise<void> {
        await RefreshToken.updateOne(
            { userId, token },
            { isRevoked: true }
        );
    }

    /**
     * Checks if a refresh token has been revoked
     * @param {string} token - The token to check
     * @returns {Promise<boolean>} True if token is revoked or doesn't exist
     * @private
     */
    private async isTokenRevoked(token: string): Promise<boolean> {
        const tokenDoc = await RefreshToken.findOne({ token });
        return (!tokenDoc || tokenDoc.isRevoked) ?? false;
    }

    /**
     * Removes expired tokens from the database
     * Should be run periodically to maintain database cleanliness
     */
    async cleanupExpiredTokens(): Promise<void> {
        try {
            await RefreshToken.deleteMany({
                expiresAt: { $lt: new Date() }
            });
            logger.debug('Expired tokens cleaned up successfully');
        } catch (error) {
            logger.error('Failed to cleanup expired tokens:', error);
        }
    }

    /**
     * Rotate the user's JWT tokens by generating new ones and revoking the old refresh token
     * @param refreshToken The user's refresh token
     * @returns accessToken, refreshToken, and payload if successful, null otherwise
     */
    async rotateTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; payload: TokenPayload } | null> {
        try {
            const refreshResult = await this.refreshAccessToken(refreshToken);
            if (!refreshResult) return null;

            const { payload } = refreshResult;

            // Generate new tokens
            const newTokens = await this.generateTokens({
                userId: payload.userId,
            });

            // Revoke old refresh token
            await this.revokeRefreshToken(payload.userId, refreshToken);

            return {
                accessToken: refreshResult.accessToken,
                refreshToken: newTokens.refreshToken,
                payload
            };
        } catch (error) {
            logger.error('Token rotation failed:', error);
            return null;
        }
    }

    /**
     * Sets the access and refresh tokens as cookies in the response
     * @param res Express response object
     * @param accessToken The access token to set
     * @param refreshToken The refresh token to set
     */
    async setCookies(res: Response, accessToken: string, refreshToken: string): Promise<void> {
        res.cookie("accessToken", accessToken, tokenCookieOptions.accessToken);
        res.cookie("refreshToken", refreshToken, tokenCookieOptions.refreshToken);
        logger.debug('Cookies set successfully');
    }

    /**
     * Verifies and refreshes tokens if needed, updating cookies automatically
     * @param cookies Current token cookies from request
     * @param res Express response object for updating cookies
     * @returns The verified or refreshed payload, or null if authentication failed
     */
    async verifyAndRefreshTokens(cookies: { accessToken?: string; refreshToken?: string }, res: Response): Promise<TokenPayload | null> {
        try {
            // First try to verify access token
            let payload = cookies.accessToken ? this.verifyAccessToken(cookies.accessToken) : null;

            // If access token invalid/expired, try refresh and rotate tokens
            if (!payload && cookies.refreshToken) {
                const rotated = await this.rotateTokens(cookies.refreshToken);
                if (rotated) {
                    payload = rotated.payload;
                    // Update both cookies with the new tokens
                    res.cookie("accessToken", rotated.accessToken, tokenCookieOptions.accessToken);
                    res.cookie("refreshToken", rotated.refreshToken, tokenCookieOptions.refreshToken);

                    logger.debug('Tokens rotated successfully', { userId: payload.userId });
                }
            }

            return payload;
        } catch (error) {
            logger.error('Token verification/refresh failed:', error);
            // Clear cookies on failure
            res.clearCookie("accessToken", tokenCookieOptions.accessToken);
            res.clearCookie("refreshToken", tokenCookieOptions.refreshToken);
            return null;
        }
    }
}

export const jwtService = JWTService.getInstance();

// Cleanup expired tokens every hour
cron.scheduleJob('0 * * * *', async () => {
    await jwtService.cleanupExpiredTokens();
});