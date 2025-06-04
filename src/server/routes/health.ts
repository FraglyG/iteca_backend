import { Route } from "../package";

new Route("GET:/api/health").onCall((req, res) => {
    res.status(200).json({
        status: "ok",
        message: "GigTree API is running smoothly!",
        timestamp: new Date().toISOString(),
        uptime: process.uptime() * 1000, // uptime converted to milliseconds for consistency
    });
})