import { Schema, model } from 'mongoose';

const refreshTokenSchema = new Schema({
    userId: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    issuedAt: { type: Date, default: Date.now },
    isRevoked: { type: Boolean, default: false }
}, { timestamps: true });

refreshTokenSchema.index({ token: 1 });
refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ expiresAt: 1 });

export const RefreshToken = model('RefreshToken', refreshTokenSchema);