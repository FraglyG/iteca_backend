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

    /** Information relating to the user's profile */
    profile: {
        /** User's bio */
        bio?: string;
        /** User's profile picture */
        profilePicture?: string;
        /** User's first name */
        firstName: string;
        /** User's last name */
        lastName: string;
    },

    /** Moderation information relating to the user's profile */
    moderation?: {
        /** User ban information */
        ban?: {
            /** Whether the user is currently banned */
            isBanned?: boolean;
            /** When the user was banned */
            bannedAt?: Date;
            /** The reason for the ban */
            banReason?: string;
            /** When the user was unbanned */
            unbannedAt?: Date;
        },

        /** User's chat-mute information */
        muted?: {
            /** Whether the user is currently muted */
            isMuted?: boolean;
            /** When the user was muted */
            mutedAt?: Date;
            /** The reason for the mute */
            muteReason?: string;
            /** When the user was unmuted */
            unmutedAt?: Date;
        }

        /** User's job-listing ban information */
        jobListingBan?: {
            /** Whether the user is currently banned from posting job listings */
            isBanned?: boolean;
            /** When the user was banned from posting job listings */
            bannedAt?: Date;
            /** The reason for the job listing ban */
            banReason?: string;
            /** When the user was unbanned from posting job listings */
            unbannedAt?: Date;
        },
    }
}

// SCHEMA
const userSchema = new Schema<UserInterface>({
    userId: { type: String, default: () => getKey("user") },
    username: { type: String },
    passwordHash: { type: String, required: true },

    primaryEmail: { type: String },

    emailVerified: { type: Boolean, default: false },
    emailVerification: {
        isPending: { type: Boolean, default: false },
        verificationCode: { type: String },
        sentDate: { type: Date },
        expiresAt: { type: Date },
    },    profile: {
        type: {
            bio: { type: String },
            profilePicture: { type: String },
            firstName: { type: String, required: true },
            lastName: { type: String, required: true },
        },
        default: {}
    },

    moderation: {
        ban: {
            isBanned: { type: Boolean, default: false },
            bannedAt: { type: Date },
            banReason: { type: String },
            unbannedAt: { type: Date },
        },
        muted: {
            isMuted: { type: Boolean, default: false },
            mutedAt: { type: Date },
            muteReason: { type: String },
            unmutedAt: { type: Date },
        },
        jobListingBan: {
            isBanned: { type: Boolean, default: false },
            bannedAt: { type: Date },
            banReason: { type: String },
            unbannedAt: { type: Date },
        }
    }
}, { timestamps: true })

// INDEXES
userSchema.index({ userId: 1 }, { unique: true });
userSchema.index({ primaryEmail: 1 }, { unique: true, sparse: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });

// CREATE MODEL
export const userModel = model<UserInterface>('User', userSchema);
export default userModel;