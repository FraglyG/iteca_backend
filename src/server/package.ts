import { Request, Response } from "express";
import { getLogger } from "../util/logger";
import { app } from "./server";
import { validateJWTRequest } from "./auth/util";
import { userModel } from "../mongoose";
import { z, ZodSchema, ZodError } from "zod";
import CONFIG from "../util/config";

// INIT
const logger = getLogger("ROUTE.PACK");
const ROUTES = new Map<RouteCompositionId, Route>();

// TYPES
export type RouteMethods = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
export type RouteCompositionId = `${RouteMethods}:${string}`;
export type RouteValidationSchema = ZodSchema<any>;

type RouteAuthConfigJWT = {
    type: "JWT";
    config?: {
        /** Whether to return the full user in req.user, otherwise will just return tokenized payload */
        getFullUser?: boolean;
    }
}

export type RouteAuthConfig = RouteAuthConfigJWT;

// HELPERS

function validateWithZodSchema(data: any, schema: RouteValidationSchema): { success: boolean; data?: any; errors?: string[] } {
    try {
        const validatedData = schema.parse(data);
        return { success: true, data: validatedData };
    } catch (error) {
        if (error instanceof ZodError) {
            const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
            logger.debug(`(SCHEMA) Validation failed: ${errorMessages.join(", ")}`);
            return { success: false, errors: errorMessages };
        }
        logger.debug("(SCHEMA) Unknown validation error");
        return { success: false, errors: ["Unknown validation error"] };
    }
}

// CLASSES
export class Route {
    public method: RouteMethods;
    public path: string;
    public route: RouteCompositionId;

    private middleware: ((req: Request, res: Response, next: () => void) => void)[] = [];

    private schemas = {
        body: null as RouteValidationSchema | null,
        query: null as RouteValidationSchema | null,
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
    auth({ type, config }: RouteAuthConfig) {
        if (type !== "JWT") throw new Error(`[ROUTE.PACK] Unsupported authentication type: ${type}`);
        logger.debug(`Authentication required for route ${this.route}`);

        this.middleware.push(async (req, res, next) => {
            const validated = await validateJWTRequest(req, res);
            if (!validated) return res.status(401).json({ success: false, error: "Unauthorized", message: "Invalid or missing authentication." });

            // If config is provided, handle it
            if (config?.getFullUser) {
                const user = await userModel.findOne({ userId: req.user.userId });
                if (!user) {
                    logger.warn(`User not found for userId: ${req.user.userId}`);
                    return res.status(404).json({ success: false, error: "Not Found", message: "User not found." });
                }

                req.user = user.toObject(); // Convert Mongoose document to plain object
                logger.debug(`Full user data attached to request for userId: ${req.user.userId}`);
            }

            return next();
        });
        return this;
    }

    requireAdmin() {
        logger.debug(`Admin privileges required for route ${this.route}`);

        this.middleware.push((req, res, next) => {
            const user = req.user as { userId: string } | null;
            if (!user) {
                logger.warn("Admin middleware called without user authentication");
                return res.status(401).json({ success: false, error: "Unauthorized", message: "Authentication required" });
            }

            // Check if user is in the admin list
            if (!CONFIG.moderation.adminUserIds.includes(user.userId)) {
                logger.warn(`Non-admin user ${user.userId} attempted to access admin endpoint`);
                return res.status(403).json({ success: false, error: "Forbidden", message: "Admin privileges required" });
            }

            logger.debug(`Admin user ${user.userId} accessing admin endpoint`);
            next();
        });
        return this;
    }

    /** Add a schema to automatically check the input of the body */
    public expectBody(schema: RouteValidationSchema) {
        this.schemas.body = schema;
        return this;
    }

    /** Add a schema to automatically check the input of the query */
    public expectQuery(schema: RouteValidationSchema) {
        this.schemas.query = schema;
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

            // Validate request data
            const validateRequestData = (data: any, schema: RouteValidationSchema | null, type: 'body' | 'query') => {
                if (!schema) return true;

                const validation = validateWithZodSchema(data, schema);
                if (!validation.success) {
                    logger.warn(`Request ${type} validation failed for route ${this.route}`);
                    res.status(400).json({
                        success: false,
                        error: "Bad Request",
                        message: `Request ${type} validation failed.`,
                        validationErrors: validation.errors || [],
                    });
                    return false;
                }

                // Replace data with validated data (just overwrite body in both cases cause query is readonly)
                if (type === "body" || type === "query") req.body = validation.data;
                else {
                    logger.error(`Invalid validation type: ${type}`);
                    res.status(500).json({ success: false, error: "Internal Server Error", message: "Invalid validation type." });
                    return false;
                }

                return true;
            };

            // Validate body and query
            if (!validateRequestData(req.body, this.schemas.body, 'body')) return;
            if (!validateRequestData(req.query, this.schemas.query, 'query')) return;

            // Forward
            handler(req as Request, res);
        })
    }
}