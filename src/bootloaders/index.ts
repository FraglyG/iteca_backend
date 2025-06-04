import { getLogger } from "../util/logger";
import { loadedInitializers } from "./initializer_package";

const logger = getLogger("BOOT");

// BOOT LOADER
export async function initialize() {
    // Start Log
    logger.info("--- Initializing GigTree ---");

    // Loaders
    const intializers = Array.from(loadedInitializers.values());
    const initializeResultArray = await Promise.all(intializers.map((initializer) => initializer.run()));
    const allSuccessful = initializeResultArray.every((result) => result === true);

    if (!allSuccessful) {
        logger.error("GigTree Initialization Failed: One or more initializers failed");
        process.exit(1);
    }

    // Success Log
    logger.success("--- GigTree Initialized ---");
}

export default initialize;
export * from "./initializer_package";