import { getLogger } from "../../../util/logger";
import { Route } from "../../package";

const logger = getLogger("ROUTE.GET_USER");

new Route("GET:/api/user/from/jwt").auth({ type: "JWT", config: { getFullUser: true } }).onCall(async (req, res) => {
    res.json(req.user);
});