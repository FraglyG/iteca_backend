import express from "express";
import cors from "cors";
import CONFIG from "../util/config";
import { getLogger } from "../util/logger";
import { Initializer } from "../bootloaders";

const logger = getLogger("SERVER");
export const app = express();

// Configuration Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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