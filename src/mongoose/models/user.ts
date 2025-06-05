import { model, Schema } from "mongoose";
import { getKey } from "../util/id";

// INTERFACE
export interface UserInterface {
    userId: string;
}

// SCHEMA
const userSchema = new Schema<UserInterface>({
    userId: { type: String, default: () => getKey("user") },
})

// INDEXES
userSchema.index({ userId: 1 }, { unique: true });

// CREATE MODEL
const userModel = model<UserInterface>('User', userSchema);
export default userModel;