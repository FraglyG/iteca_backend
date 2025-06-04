export const CONFIG = {
    /** Server configuration */
    server: {
        /** The port the main server will listen on */
        port: process.env.PORT || 3000,
    },

    /** Whether the app will start in debug mode */
    log_level: process.env.LOG_LEVEL || "info",
} as const;

export default CONFIG;