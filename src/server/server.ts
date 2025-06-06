import express from "express";
import cors from "cors";
import CONFIG from "../util/config";
import { getLogger } from "../util/logger";
import { Initializer } from "../bootloaders";
import cookies from "cookie-parser";

const logger = getLogger("SERVER");
export const app = express();

// Configuration Middleware
app.use(cors({
    origin: (origin, callback) => {
        const allowedOriginPattern = new RegExp(`^https?://.*${CONFIG.domain.base.replace(/\./g, '\\.')}.*$`);
        if (!origin || allowedOriginPattern.test(origin)) {
            logger.silly(`CORS policy allowed request from origin: ${origin || 'unknown'}`);
            callback(null, true);
        } else {
            logger.warn(`CORS policy blocked request from origin: ${origin}`);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookies());

// Routes

app.get("/", (req, res) => {
    res.send("Hello South Africa!");
});

// Initialize Function
new Initializer("SERVER", async () => {
    // Init Routes
    await import("./route_registry");

    // Listener
    app.listen(CONFIG.server, () => {
        logger.success(`Server is running on port ${CONFIG.server.port}`);
    });

    return true;
})