import { getLogger } from "../util/logger";

export const loadedInitializers = new Map<string, Initializer>();
const logger = getLogger("BOOT.PACK")

export type InitializerFunction = () => PromiseLike<boolean>;

export class Initializer {
    constructor(public name: string, private runner: InitializerFunction) {
        if (loadedInitializers.has(name)) logger.warn(`Loader with name ${name} already exists. Overwriting...`);
        loadedInitializers.set(name, this);
    }


    /** Run the bootloader, will fail safely */
    async run() {
        try {
            const result = await this.runner();
            if (!result) logger.error(`Bootloader ${this.name} failed gracefully.`);
            return result;
        } catch (error) {
            logger.error(`Bootloader ${this.name} failed miserably: ${error}`);
            return false;
        }
    }
}


