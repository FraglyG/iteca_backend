import { Request, Response } from "express";
import { jwtService, TokenPayload } from "./jwt";
import { getLogger } from "../../util/logger";

const logger = getLogger("ROUTE.AUTH")

export async function validateJWT(accessToken: string, refreshToken?: string): Promise<TokenPayload | null> {
    if (!accessToken) {
        logger.warn("Access token is missing");
        return null;
    }

    const accessTokenValidationPayload = await jwtService.verifyAccessToken(accessToken);
    if (!accessTokenValidationPayload) {
        logger.debug("Access token validation failed");
        return null;
    }

    if (refreshToken) {
        const refreshTokenValidationPayload = await jwtService.verifyRefreshToken(refreshToken);
        if (!refreshTokenValidationPayload) {
            logger.debug("Refresh token validation failed");
            return null;
        }

        if (accessTokenValidationPayload.userId !== refreshTokenValidationPayload.userId) {
            logger.warn("Access token and refresh token do not match");
            return null;
        }
    }

    return accessTokenValidationPayload;
}

export async function validateJWTRequest(req: Request, res: Response): Promise<boolean> {
    if (!req.cookies) {
        logger.warn(`No cookies passed for JWT validation from IP: ${req.ip}`);
        return false;
    }

    const cookies = {
        accessToken: req.cookies.accessToken,
        refreshToken: req.cookies.refreshToken
    };

    // Early return if no refresh token
    if (!cookies.refreshToken) {
        logger.debug(`No refresh token present from IP: ${req.ip}`);
        return false;
    }

    const payload = await jwtService.verifyAndRefreshTokens(cookies, res);
    if (!payload) {
        logger.debug(`Authentication faeiled from IP: ${req.ip}`);
        return false;
    }

    req.user = payload;
    return true;
}