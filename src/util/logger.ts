import { addColors, createLogger, format, transports } from "winston";
import { AbstractConfigSetColors, AbstractConfigSetLevels } from "winston/lib/winston/config";
import "dotenv/config";
import CONFIG from "./config";

type WinstonLogLevels = {
    levels: AbstractConfigSetLevels;
    colors: AbstractConfigSetColors;
}

const customLevels: WinstonLogLevels = {
    levels: {
        error: 0,
        warn: 1,
        success: 2,
        info: 2,
        http: 3,
        verbose: 4,
        debug: 5,
        silly: 6,
    },
    colors: {
        info: "blue",
        success: "green",
    }
};

addColors(customLevels.colors);

const loggers = new Map<string, ReturnType<typeof createLogger>>();

export function getLogger(jurisdiction: string) {
    const winstonLogger = createLogger({
        level: 'info',
        levels: customLevels.levels,
        format: format.json(),
        defaultMeta: { jurisdiction, service: 'gigtree_backend' },
    });

    if (process.env.NODE_ENV !== 'production') {
        // Use normal logs in development
        winstonLogger.add(new transports.Console({
            format: format.combine(
                format.colorize({ all: true }),
                format.printf(({ level, message }) => `[${jurisdiction}] ${message}`)
            ),
            level: CONFIG.log_level || 'info',
        }));
    } else {
        // Use JSON logs in production
        winstonLogger.add(new transports.Console({
            format: format.combine(
                format.json(),
                format.printf(({ message }) => `[${jurisdiction}] ${message}`)
            ),
            level: CONFIG.log_level || 'info',
        }));
    }

    (winstonLogger as any).success = function (message: string, meta?: any) {
        this.log('success', message, meta);
    };

    // register logger

    loggers.set(jurisdiction, winstonLogger);

    // return
    return winstonLogger as typeof winstonLogger & {
        success: typeof winstonLogger.info;
    };
}