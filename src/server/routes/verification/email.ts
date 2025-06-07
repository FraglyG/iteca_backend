import { z } from "zod";
import { getLogger } from "../../../util/logger";
import { Route } from "../../package";
import { access } from "fs";
import { validateJWT } from "../../auth/util";
import { userModel } from "../../../mongoose";
import CONFIG from "../../../util/config";

const logger = getLogger("ROUTE.GET_USER");

const userFromJwtRawSchema = z.object({
    code: z.string().min(1, "Verification code is required"),
});

function htmlReturn(message: string) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification - ITECA</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #1a1a1a 0%, #2d1b1b 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #ffffff;
                }
                
                .container {
                    background: rgba(0, 0, 0, 0.8);
                    border: 2px solid #cc0000;
                    border-radius: 12px;
                    padding: 2rem;
                    max-width: 500px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 8px 32px rgba(204, 0, 0, 0.3);
                }
                
                .logo {
                    font-size: 2rem;
                    font-weight: bold;
                    color: #cc0000;
                    margin-bottom: 1rem;
                    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
                }
                
                .message {
                    font-size: 1.1rem;
                    line-height: 1.6;
                    margin-bottom: 1.5rem;
                    color: #e0e0e0;
                }
                
                .footer {
                    font-size: 0.9rem;
                    color: #999;
                    margin-top: 1rem;
                    border-top: 1px solid #333;
                    padding-top: 1rem;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">GigTree</div>
                <div class="message">${message}</div>
            </div>
        </body>
        </html>
    `;
}

new Route("GET:/verify/email").expectQuery(userFromJwtRawSchema).onCall(async (req, res) => {
    const { code } = req.query as z.infer<typeof userFromJwtRawSchema>;

    const user = await userModel.findOne({ "emailVerification.verificationCode": code });
    if (!user) {
        logger.warn(`User not found for verification code: ${code}`);
        return res.status(404).send(htmlReturn("Verification code not found or expired."));
    }

    if (!user.emailVerification?.isPending) {
        logger.warn(`Email verification already completed`);
        return res.status(400).send(htmlReturn("Email verification already completed."));
    }

    // Mark as verified
    user.emailVerified = true;
    user.emailVerification = undefined;
    user.markModified("emailVerification");
    await user.save();

    logger.info(`Email verification successful for user: ${user.userId}`);
    res.send(htmlReturn(`Email verification successful! You can now log in <a style="color: red;" href="${CONFIG.domain.frontendUri}/login">here</a>.`));
});