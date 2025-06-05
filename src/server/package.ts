import { Request, Response } from "express";
import { getLogger } from "../util/logger";
import { app } from "./server";
import { validateJWTRequest } from "./auth/util";

// INIT
const logger = getLogger("ROUTE.PACK");
const ROUTES = new Map<RouteCompositionId, Route>();

// TYPES
export type RouteMethods = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
export type RouteCompositionId = `${RouteMethods}:${string}`;
export type RouteValidationSchema = Record<string, any>;

// HELPERS

function compareToSchema(body: Record<string, any>, schema: RouteValidationSchema): boolean {
    if (!body || typeof body !== 'object') {
        logger.debug("(SCHEMA) Invalid body passed for schema validation");
        return false;
    }

    // Simple schema validation logic
    for (const key in schema) {
        if (!(key in body)) {
            logger.debug(`(SCHEMA) Missing key in body: ${key}`);
            return false;
        }
        if (typeof body[key] !== schema[key]) {
            logger.debug(`(SCHEMA) Type mismatch for key ${key}: expected ${schema[key]}, got ${typeof body[key]}`);
            return false;
        }
    }
    return true;
}

// CLASSES
export class Route {
    public method: RouteMethods;
    public path: string;
    public route: RouteCompositionId;

    private middleware: ((req: Request, res: Response, next: () => void) => void)[] = [];

    private schemas = {
        body: null as Record<string, any> | null,
    }

    // TODO: honestly idk if this dual constructor is necessary, in the future see which one you prefer and remove the other
    constructor(route: RouteCompositionId);
    constructor(method: RouteMethods, path: string);
    constructor(routeOrMethod: RouteCompositionId | RouteMethods, path?: string) {
        if (path) {
            this.method = routeOrMethod as RouteMethods;
            this.path = path;
            this.route = `${routeOrMethod}:${path}` as RouteCompositionId;
        } else {
            if (typeof routeOrMethod !== "string" || !/^([A-Z]+):.+$/.test(routeOrMethod)) {
                logger.error(`Invalid route format: ${routeOrMethod}`);
                throw new Error(`Invalid route format: ${routeOrMethod}`);
            }

            const [method, path] = routeOrMethod.split(":");
            this.method = method as RouteMethods;
            this.path = path;
            this.route = routeOrMethod as RouteCompositionId;
        }

        if (ROUTES.has(this.route)) logger.warn(`Route ${this.route} already exists, overwriting...`);
        ROUTES.set(this.route, this);

        logger.debug(`Route created: ${this.method} on ${this.path}`);
    }

    /** Require authentication for this endpoint */
    auth(type: "JWT") {
        if (type !== "JWT") throw new Error(`[ROUTE.PACK] Unsupported authentication type: ${type}`);
        logger.debug(`Authentication required for route ${this.route}`);

        this.middleware.push(async (req, res, next) => {
            const validated = await validateJWTRequest(req, res);
            if (validated) return next();
        });
        return this;
    }

    /** Add a schema to automatically check the input of the body */
    public expectBody(schema: RouteValidationSchema) {
        this.schemas.body = schema;
        return this;
    }

    /** Handler for when this route is called */
    public onCall(handler: (req: Request, res: Response) => void) {
        const [method, path] = this.route.split(":");

        if (!method || !path) {
            logger.error(`Invalid route format: ${this.route}`);
            return;
        }

        // Subscribe to server requests on this route
        app[method.toLowerCase() as keyof typeof app](path, this.middleware, (req: Request, res: Response) => {
            logger.debug(`Route called: ${this.method} on ${this.path}`);

            // Validate request body 
            if (this.schemas.body && !compareToSchema(req.body, this.schemas.body)) {
                logger.warn(`Request body does not match schema for route ${this.route}`);
                res.status(400).json({ success: false, error: "Bad Request", message: "Request body does not match expected schema." });
                return;
            }

            // Forward
            handler(req as Request, res);
        })
    }
}