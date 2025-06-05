import { UserInterface, userModel } from "../../../mongoose";
import CONFIG from "../../../util/config";
import { getLogger } from "../../../util/logger";
import { Route, RouteValidationSchema } from "../../package";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { stime } from "../../../util/static";
import { jwtService } from "../../auth/jwt";

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

function inputValidation(input: { username: string, firstName: string, lastName: string, password: string, email?: string }) {
    const { username, firstName, lastName, password, email } = input;

    function isAlphanumericUnderscore(str: string): boolean {
        return /^[a-zA-Z0-9_]+$/.test(str);
    }

    function isValidLength(str: string, min: number, max: number): boolean {
        return str.length >= min && str.length <= max;
    }

    if (!username || !firstName || !lastName || !password) {
        return { success: false, error: "Missing Required Fields", message: "Username, first name, last name, and password are required." };
    }

    // EMAIL
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: "Invalid Email Format", message: "The provided email address is not valid." };
    }

    // USERNAME
    if (!isAlphanumericUnderscore(username)) {
        return { success: false, error: "Invalid Username Characters", message: "Username can only contain alphanumeric characters and underscores." };
    }
    if (isValidLength(username, 3, 20)) {
        return { success: false, error: "Invalid Username Length", message: "Username must be between 3 and 20 characters long." };
    }

    // FIRSTNAME
    if (!isAlphanumericUnderscore(firstName)) {
        return { success: false, error: "Invalid First Name Characters", message: "First name can only contain alphanumeric characters and underscores." };
    }
    if (isValidLength(firstName, 1, 50)) {
        return { success: false, error: "Invalid First Name Length", message: "First name must be between 1 and 50 characters long." };
    }

    // LASTNAME
    if (!isAlphanumericUnderscore(lastName)) {
        return { success: false, error: "Invalid Last Name Characters", message: "Last name can only contain alphanumeric characters and underscores." };
    }
    if (isValidLength(lastName, 1, 50)) {
        return { success: false, error: "Invalid Last Name Length", message: "Last name must be between 1 and 50 characters long." };
    }

    // PASSWORD
    if (!isValidLength(password, 5, 50)) {
        return { success: false, error: "Invalid Password Length", message: "Password must be between 5 and 50 characters long." };
    }

    return { success: true };
}

// SIGNUP ROUTE

const signupBodySchema: RouteValidationSchema = {
    username: String,
    firstName: String,
    lastName: String,
    password: String,
    email: String || undefined,
}

new Route("POST:/api/authv1/signup").expectBody(signupBodySchema).onCall(async (req, res) => {
    const { username, firstName, lastName, password, email } = req.body;

    // Check if sign-up is enabled
    if (!CONFIG.signUp.enabled) {
        return res.status(403).json({ success: false, error: "Sign-Up Disabled", message: "Sign-up is currently disabled on this server." });
    }

    // Validate input
    const validation = inputValidation({ username, firstName, lastName, password, email });
    if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error, message: validation.message });
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
            firstName,
            lastName,
            primaryEmail: email,
            emailVerification,
            emailVerified: false,
            passwordHash,
        });

        // Create JWT tokens
        await jwtService.generateTokens({ userId: user.userId, });

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