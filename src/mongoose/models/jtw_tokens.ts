import { Schema, model } from 'mongoose';

interface RefreshTokenInterface {
    /** The user's ID */
    userId: string;
    /** The refresh token string */
    token: string;
    /** The date when the refresh token expires */
    expiresAt: Date;
    /** The date when the refresh token was issued */
    issuedAt?: Date;
    /** Whether the refresh token has been revoked */
    isRevoked?: boolean;
}

const refreshTokenSchema = new Schema<RefreshTokenInterface>({
    userId: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    issuedAt: { type: Date, default: Date.now },
    isRevoked: { type: Boolean, default: false }
}, { timestamps: true });

refreshTokenSchema.index({ token: 1 });
refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ expiresAt: 1 });

export const RefreshToken = model<RefreshTokenInterface>('RefreshToken', refreshTokenSchema);