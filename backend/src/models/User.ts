import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email?: string; // optional: wallet-only users won't have one
  password?: string; // optional: wallet-only users won't have one
  walletAddress?: string; // set once wallet login is linked (Module 2)
  walletNonce?: string; // one-time value the user must sign to prove wallet ownership
  googleId?: string; // set once Google Sign-In is linked/used (Module 6)
  role: 'user' | 'admin';
  isActive: boolean;
  refreshTokens: string[]; // supports multiple concurrent sessions/devices
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true, // allows many docs with no email (wallet-only users)
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, select: false }, // never returned by default
    walletAddress: {
      type: String,
      lowercase: true,
      unique: true,
      sparse: true, // allows many docs with no walletAddress
      index: true,
    },
    walletNonce: { type: String, select: false },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // allows many docs with no googleId (email/wallet-only users)
      index: true,
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
    refreshTokens: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (
  candidate: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser>('User', userSchema);
