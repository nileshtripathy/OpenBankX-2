import { Schema, model, Document, Types } from 'mongoose';

export interface IBankAccount extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  provider: 'plaid' | 'mock';
  itemId: string;
  accessTokenEncrypted: string; // never returned by default
  providerAccountId: string;
  institutionName: string;
  accountName: string;
  officialName?: string;
  accountType: string;
  mask: string;
  currency: string;
  currentBalance: number;
  availableBalance: number;
  status: 'active' | 'revoked';
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bankAccountSchema = new Schema<IBankAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['plaid', 'mock'], required: true },
    itemId: { type: String, required: true, index: true },
    accessTokenEncrypted: { type: String, required: true, select: false },
    providerAccountId: { type: String, required: true },
    institutionName: { type: String, required: true },
    accountName: { type: String, required: true },
    officialName: { type: String },
    accountType: { type: String, required: true },
    mask: { type: String, required: true },
    currency: { type: String, default: 'USD' },
    currentBalance: { type: Number, default: 0 },
    availableBalance: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One record per (user, provider account) - re-linking the same account updates it, doesn't duplicate.
bankAccountSchema.index({ userId: 1, providerAccountId: 1 }, { unique: true });

export const BankAccount = model<IBankAccount>('BankAccount', bankAccountSchema);
