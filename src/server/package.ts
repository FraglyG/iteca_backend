import { Request, Response } from "express";
import { getLogger } from "../util/logger";
import { app } from "./server";
import CONFIG from "../util/config";

// INIT
const logger = getLogger("ROUTE.PACK");
const ROUTES = new Map<RouteCompositionId, Route>();

// TYPES
type RouteMethods = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
type RouteCompositionId = `${RouteMethods}:${string}`;

// CLASSES
export class Route {
    public method: RouteMethods;
    public path: string;
    public route: RouteCompositionId;

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

    /** Handler for when this route is called */
    public onCall(handler: (req: Request, res: Response) => void) {
        const [method, path] = this.route.split(":");

        if (!method || !path) {
            logger.error(`Invalid route format: ${this.route}`);
            return;
        }

        // Subscribe to server requests on this route
        (app[method.toLowerCase() as keyof typeof app] as typeof app.use)(path, (req, res) => {
            logger.debug(`Route called: ${this.method} on ${this.path}`);
            handler(req, res);
        })
    }
}