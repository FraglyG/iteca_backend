import { UserInterface, userModel } from "../../../mongoose";
import CONFIG from "../../../util/config";
import { getLogger } from "../../../util/logger";
import { Route } from "../../package";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { stime } from "../../../util/static";
import { jwtService } from "../../auth/jwt";
import { z } from "zod";

const logger = getLogger("ROUTE.SIGNUP");

// HELPER FUNCTIONS

function generateEmailVerificationCode() {
    // Create composition data
    const randomBytes = crypto.randomBytes(32);
    const timestamp = Date.now().toString();
    const combinedData = randomBytes.toString('hex') + timestamp;

    // Create hash of above composition
    const code = crypto.createHash('sha256').update(combinedData).digest('hex');
    const expiresAt = new Date(Date.now() + stime.hour * 24);

    return { code, expiresAt };
}

async function generatePasswordHash(password: string) {
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);
    return hash;
}

// SIGNUP ROUTE

const signupBodySchema = z.object({
    username: z.string()
        .min(3, "Username must be at least 3 characters long")
        .max(20, "Username must be at most 20 characters long")
        .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain alphanumeric characters and underscores"),
    firstName: z.string()
        .min(1, "First name is required")
        .max(50, "First name must be at most 50 characters long")
        .regex(/^[a-zA-Z0-9_]+$/, "First name can only contain alphanumeric characters and underscores"),
    lastName: z.string()
        .min(1, "Last name is required")
        .max(50, "Last name must be at most 50 characters long")
        .regex(/^[a-zA-Z0-9_]+$/, "Last name can only contain alphanumeric characters and underscores"),
    password: z.string()
        .min(5, "Password must be at least 5 characters long")
        .max(50, "Password must be at most 50 characters long"),
    email: z.string()
        .email("Invalid email format")
        .optional()
});

new Route("POST:/api/authv1/signup").expectBody(signupBodySchema).onCall(async (req, res) => {
    const { username, firstName, lastName, password, email } = req.body as z.infer<typeof signupBodySchema>;

    // Check if sign-up is enabled
    if (!CONFIG.signUp.enabled) {
        return res.status(403).json({ success: false, error: "Sign-Up Disabled", message: "Sign-up is currently disabled on this server." });
    }

    // Check if email is required
    if (CONFIG.signUp.requireEmail && !email) {
        return res.status(400).json({ success: false, error: "Email Required", message: "Email is required for sign-up." });
    }

    // Check if username already exists
    if (username) {
        const existingUser = await userModel.findOne({ username });
        if (existingUser) return res.status(400).json({ success: false, error: "Username Already Exists", message: "An account with this username already exists." });
    }

    // Check if email already exists
    if (email) {
        const existingUser = await userModel.findOne({ primaryEmail: email });
        if (existingUser) return res.status(400).json({ success: false, error: "Email Already Exists", message: "An account with this email already exists." });
    }

    // Create user
    try {
        // Generate email verification data
        const emailVerification = CONFIG.signUp.requireEmailVerification ? (() => {
            const { code, expiresAt } = generateEmailVerificationCode();
            return { isPending: true, verificationCode: code, sendDate: new Date(), expiresAt } as UserInterface["emailVerification"];
        })() : undefined;

        // Create secure password-hash
        const passwordHash = await generatePasswordHash(password);

        // Create user
        const user = await userModel.create({
            username, firstName, lastName, passwordHash, emailVerification,
            primaryEmail: email, emailVerified: false,
        });

        // Create JWT tokens
        // Commented out cause we'll handle this in the login route to force users to log in after sign-up
        // await jwtService.generateTokens({ userId: user.userId, });

        // Logging
        logger.success(`New user created: ${user.userId} (${user.primaryEmail})`, { firstName, lastName, email, emailVerification });

        // Respond with success
        res.status(201).json({
            success: true,
            message: "User created successfully.",
            userId: user.userId,
            emailVerificationRequired: CONFIG.signUp.requireEmailVerification,
        });
    } catch (error) {
        logger.error(`Error creating user: ${(error as Error).message || "Unknown Error"}`, { error });
        res.status(500).json({ success: false, error: "Internal Server Error", message: "An error occurred while storing data in database." });
    }
})