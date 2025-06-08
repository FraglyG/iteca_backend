import { userModel } from "../../../mongoose";
import CONFIG from "../../../util/config";
import { getLogger } from "../../../util/logger";
import { Route } from "../../package";
import bcrypt from "bcrypt";
import { jwtService } from "../../auth/jwt";
import { z } from "zod";

const logger = getLogger("ROUTE.LOGIN");

// HELPER FUNCTIONS

async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}

function isEmail(input: string): boolean {
    return input.includes('@');
}

// LOGIN ROUTE

const loginBodySchema = z.object({
    identifier: z.string()
        .min(1, "Username or email is required"), // Can be either username or email
    password: z.string()
        .min(1, "Password is required"),
});

new Route("POST:/api/authv1/login").expectBody(loginBodySchema).onCall(async (req, res) => {
    const { identifier, password } = req.body as z.infer<typeof loginBodySchema>;

    // Quick checks
    if (!CONFIG.login?.enabled) return res.status(403).json({ success: false, error: "Login Disabled", message: "Login is currently disabled on this server." });
    if (!identifier) return res.status(400).json({ success: false, error: "Missing Credentials", message: "Username or email must be provided." });

    try {
        // Automatically detect if identifier is email or username
        const isEmailIdentifier = isEmail(identifier);
        const query = isEmailIdentifier
            ? { primaryEmail: identifier }
            : { username: identifier };

        const user = await userModel.findOne(query);
        if (!user) return res.status(401).json({ success: false, error: "Invalid Credentials", message: "Invalid username/email or password." });

        // Verify password
        const isValidPassword = await verifyPassword(password, user.passwordHash); if (!isValidPassword) return res.status(401).json({ success: false, error: "Invalid Credentials", message: "Invalid username/email or password." });

        // Check if banned (and not expired)
        if (user.moderation?.ban?.isBanned && (!user.moderation.ban.unbannedAt || new Date(user.moderation.ban.unbannedAt) > new Date())) {
            return res.status(403).json({
                success: false,
                error: "Forbidden",
                message: "Login failed because your account was banned for: "
                    + `\n\n${(user.moderation.ban.banReason || "An unspecified reason.")}`
                    + `\n\n${user.moderation.ban.unbannedAt ? `You'll be unbanned at ${new Date(user.moderation.ban.unbannedAt).toLocaleString()}` : "This ban is permanent."}`,
            });
        }

        // Check if verified
        if (CONFIG.signUp?.requireEmailVerification && !user.emailVerified) {
            return res.status(403).json({
                success: false,
                error: "Email Not Verified",
                message: "Please verify your email before logging in.",
                emailVerificationRequired: true
            });
        }

        // Generate JWT tokens
        const tokens = await jwtService.generateTokens({ userId: user.userId });
        await jwtService.setCookies(res, tokens.accessToken, tokens.refreshToken);

        // Logging
        logger.success(`User logged in: ${user.userId} (${user.primaryEmail})`, {
            identifier,
            identifierType: isEmailIdentifier ? 'email' : 'username'
        });

        // Respond with success
        res.status(200).json({
            success: true,
            message: "Login successful.",
            userId: user.userId,
        });

    } catch (error) {
        logger.error(`Error during login: ${(error as Error).message || "Unknown Error"}`, { error });
        res.status(500).json({ success: false, error: "Internal Server Error", message: "An error occurred during login." });
    }
});