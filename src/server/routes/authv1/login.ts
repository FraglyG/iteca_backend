import { userModel } from "../../../mongoose";
import CONFIG from "../../../util/config";
import { getLogger } from "../../../util/logger";
import { Route, RouteValidationSchema } from "../../package";
import bcrypt from "bcrypt";
import { jwtService } from "../../auth/jwt";

const logger = getLogger("ROUTE.LOGIN");

// HELPER FUNCTIONS

async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}

function isEmail(input: string): boolean {
    return input.includes('@');
}

// LOGIN ROUTE

const loginBodySchema: RouteValidationSchema = {
    identifier: String, // Can be either username or email
    password: String,
}

new Route("POST:/api/authv1/login").expectBody(loginBodySchema).onCall(async (req, res) => {
    const { identifier, password } = req.body;

    // Check if login is enabled
    if (!CONFIG.login?.enabled) {
        return res.status(403).json({ success: false, error: "Login Disabled", message: "Login is currently disabled on this server." });
    }

    // Validate that identifier is provided
    if (!identifier) {
        return res.status(400).json({ success: false, error: "Missing Credentials", message: "Username or email must be provided." });
    }

    try {
        // Automatically detect if identifier is email or username
        const isEmailIdentifier = isEmail(identifier);
        const query = isEmailIdentifier
            ? { primaryEmail: identifier }
            : { username: identifier };

        const user = await userModel.findOne(query);
        if (!user) return res.status(401).json({ success: false, error: "Invalid Credentials", message: "Invalid username/email or password." });

        // Verify password
        const isValidPassword = await verifyPassword(password, user.passwordHash);
        if (!isValidPassword) return res.status(401).json({ success: false, error: "Invalid Credentials", message: "Invalid username/email or password." });

        // Check if email verification is required and user is not verified
        if (CONFIG.signUp?.requireEmailVerification && !user.emailVerified) {
            return res.status(403).json({
                success: false,
                error: "Email Not Verified",
                message: "Please verify your email before logging in.",
                emailVerificationRequired: true
            });
        }

        // Generate JWT tokens
        await jwtService.generateTokens({ userId: user.userId });

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