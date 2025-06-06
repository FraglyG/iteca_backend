import { Request, Response } from "express";
import { jwtService, TokenPayload } from "./jwt";
import { getLogger } from "../../util/logger";

const logger = getLogger("ROUTE.AUTH")

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
        logger.debug(`Authentication failed from IP: ${req.ip}`);
        return false;
    }

    req.user = payload;
    return true;
}