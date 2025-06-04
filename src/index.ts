import initialize from "./bootloaders";
import "./bootloaders/registry"; // import registry here to prevent circular dependency issues

async function run() {
    try {
        await initialize();
    } catch (error) {
        console.error("Error during initialization:", error);
        process.exit(1); // Exit with failure code
    }
}

run();