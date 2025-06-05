import { getLogger } from './logger';
import { stime } from './static';

export const CONFIG = {
    /** Server configuration */
    server: {
        /** The port the main server will listen on */
        port: process.env.PORT || 3000,
    },

    /** The log level of the application */
    log_level: process.env.LOG_LEVEL || "info",

    /** JWT configuration */
    jwt: {
        /** Secret key for signing access tokens */
        secret: process.env.JWT_SECRET || "secret" as string,
        /** Secret key for signing refresh tokens */
        refreshSecret: process.env.JWT_REFRESH_SECRET || "refresh_secret" as string,
        /** Access token expiry time in milliseconds (default: 15 minutes) */
        accessTokenExpiry: Number(process.env.ACCESS_TOKEN_EXPIRY_MS) || stime.minute * 15,
        /** Refresh token expiry time in milliseconds (default: 7 days) */
        refreshTokenExpiry: Number(process.env.REFRESH_TOKEN_EXPIRY_MS) || stime.day * 7,
    },

    /** Domain configuration */
    domain: {
        /** Base domain for cookie settings */
        base: process.env.BASE_DOMAIN || 'localhost',
    },

    /** Configuration relating to the sign-up process */
    signUp: {
        /** Whether sign-up is enabled (Default: true) */
        enabled: process.env.SIGN_UP_ENABLED !== 'false',
        /** Whether email is required for sign-up (Default: true) */
        requireEmail: process.env.SIGNUP_REQUIRE_EMAIL !== 'false',
        /** Whether email verification is required for sign-up (Default: true) */
        requireEmailVerification: process.env.SIGNUP_REQUIRE_EMAIL_VERIFICATION !== 'false',
    },

    /** Configuration relating to the login process */
    login: {
        /** Whether login is enabled (Default: true) */
        enabled: process.env.LOGIN_ENABLED !== 'false',
    },

    /** Configuration relating to databases */
    database: {
        /** URL for the MongoDB database */
        mongoUrl: process.env.MONGO_URL,
    },

    /** Environment mode */
    nodeEnv: process.env.NODE_ENV || 'development',
} as const;

/** List of required environment variables */
const required = [
    CONFIG.jwt.secret,
    CONFIG.jwt.refreshSecret,
]

///////////////////////

// JWT security recommendations
if (CONFIG.jwt.secret == "secret" || CONFIG.jwt.refreshSecret == "refresh_secret") {
    console.warn("Using default JWT secrets. Please set JWT_SECRET and JWT_REFRESH_SECRET environment variables for production use.");
}

// Assumed okay for development mode
if (CONFIG.nodeEnv === "production" && CONFIG.domain.base === "localhost") {
    console.warn("Heads up! Running in production mode with BASE_DOMAIN set to 'localhost', consider changing this for production.");
}

// Validate Required Variables
function checkRequiredEnv() {
    const errors = [];
    for (const key of required) if (!key) errors.push(`Missing required environment variable: ${key}`);

    if (errors.length > 0) throw new Error("Configuration validation failed. The following required environment variables are missing:\n- " + errors.join("\n- "));
}
checkRequiredEnv();

export default CONFIG;