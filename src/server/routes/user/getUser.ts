import { z } from "zod";
import { getLogger } from "../../../util/logger";
import { Route } from "../../package";
import { access } from "fs";
import { validateJWT } from "../../auth/util";
import { userModel } from "../../../mongoose";

const logger = getLogger("ROUTE.GET_USER");

new Route("GET:/api/user/from/jwt").auth({ type: "JWT", config: { getFullUser: true } }).onCall(async (req, res) => {
    res.json(req.user);
});

const userFromJwtRawSchema = z.object({
    accessToken: z.string().min(1, "Access token is required"),
    refreshToken: z.string().min(1, "Refresh token is required").optional(),
});

new Route("GET:/api/user/from/jwt/raw").expectQuery(userFromJwtRawSchema).onCall(async (req, res) => {
    const { accessToken, refreshToken } = req.query as z.infer<typeof userFromJwtRawSchema>;

    const payload = await validateJWT(accessToken, refreshToken);
    if (!payload) {
        logger.warn("Invalid access token or refresh token");
        return res.status(401).json({ success: false, error: "Unauthorized", message: "Invalid or expired tokens." });
    }

    const user = await userModel.findOne({ userId: payload.userId });
    if (!user) {
        logger.warn(`User not found for userId: ${payload.userId}`);
        return res.status(404).json({ success: false, error: "Not Found", message: "User not found." });
    }

    res.json({ success: true, tokenPayload: payload, user: user.toObject() });
});