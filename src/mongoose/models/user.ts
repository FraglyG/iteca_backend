import { model, Schema } from "mongoose";
import { getKey } from "../util/id";

// INTERFACE
export interface UserInterface {
    /** User's UUID */
    userId: string;
    /** The user's username */
    username: string;
    /** User's hashed password */
    passwordHash: string;

    /** User's first name */
    firstName: string;
    /** User's last name */
    lastName: string;
    /** User's primary configured email, may not be configured depending on server-configuration */
    primaryEmail?: string;

    /** Whether this user's email has been verified */
    emailVerified?: boolean,
    /** Related to user's email verification */
    emailVerification?: {
        /** Whether the user is currently waiting for their email to be verified */
        isPending: boolean;
        /** Store the user's email verification hash */
        verificationCode: string;
        /** When the email verification was sent */
        sendDate: Date;
        /** When the email verification expires */
        expiresAt: Date;
    },
}

// SCHEMA
const userSchema = new Schema<UserInterface>({
    userId: { type: String, default: () => getKey("user") },
    username: { type: String },
    passwordHash: { type: String, required: true },


    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    primaryEmail: { type: String },


    emailVerified: { type: Boolean, default: false },
    emailVerification: {
        isPending: { type: Boolean, default: false },
        verificationCode: { type: String },
        sentDate: { type: Date },
        expiresAt: { type: Date },
    },
}, { timestamps: true })

// INDEXES
userSchema.index({ userId: 1 }, { unique: true });
userSchema.index({ primaryEmail: 1 }, { unique: true, sparse: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });

// CREATE MODEL
export const userModel = model<UserInterface>('User', userSchema);
export default userModel;