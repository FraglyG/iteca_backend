import mongoose from "mongoose";
import "dotenv/config";
import { getLogger } from "../util/logger";
import CONFIG from "../util/config";
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Initializer } from "../bootloaders";

// SETUP

const wlogger = getLogger("MONGODB");

// EXPORTS
new Initializer("MONGODB", async () => {
    let connectionString: string | undefined = CONFIG.database.mongoUrl;

    // check for mongodb connection
    if (!CONFIG.database.mongoUrl) {
        wlogger.warn("No MongoDB connection URL provided provided, using memory store");

        // Use in-memory MongoDB for testing or development
        const mongod = await MongoMemoryServer.create();
        connectionString = mongod.getUri();
    }

    // connect to db
    if (!connectionString) {
        wlogger.error("No MongoDB connection URL provided, cannot connect to database");
        return false;
    }

    try {
        mongoose.set('strictQuery', true)
        await mongoose.connect(connectionString)

        return true
    } catch (e) {
        wlogger.error("Error connecting to MongoDB: " + e)
        return false
    }
})