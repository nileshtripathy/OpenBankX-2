import { Schema, model, Document, Types } from 'mongoose';

export type BlockchainEventType = 'deposit' | 'withdraw' | 'transfer' | 'swap';

export interface IBlockchainTransaction extends Document {
  _id: Types.ObjectId;
  txHash: string;
  logIndex: number;
  contractName: 'vault' | 'swap';
  eventType: BlockchainEventType;
  walletAddress: string; // primary actor (msg.sender on-chain)
  counterpartyAddress?: string; // for transfers: the recipient
  tokenInAddress?: string; // address(0) = ETH
  tokenOutAddress?: string; // only set for swaps
  amountIn?: string; // stored as string - on-chain values exceed safe JS number range
  amountOut?: string;
  blockNumber: number;
  blockTimestamp: Date;
  status: 'confirmed'; // events are only ever indexed once mined; no "pending" state stored
  createdAt: Date;
}

const blockchainTransactionSchema = new Schema<IBlockchainTransaction>(
  {
    txHash: { type: String, required: true, index: true },
    logIndex: { type: Number, required: true },
    contractName: { type: String, enum: ['vault', 'swap'], required: true },
    eventType: {
      type: String,
      enum: ['deposit', 'withdraw', 'transfer', 'swap'],
      required: true,
    },
    walletAddress: { type: String, required: true, lowercase: true, index: true },
    counterpartyAddress: { type: String, lowercase: true, index: true },
    tokenInAddress: { type: String, lowercase: true },
    tokenOutAddress: { type: String, lowercase: true },
    amountIn: { type: String },
    amountOut: { type: String },
    blockNumber: { type: Number, required: true, index: true },
    blockTimestamp: { type: Date, required: true },
    status: { type: String, enum: ['confirmed'], default: 'confirmed' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// A given log (txHash + logIndex) is only ever recorded once - this is what
// makes event backfill + live subscription idempotent and safe to overlap.
blockchainTransactionSchema.index({ txHash: 1, logIndex: 1 }, { unique: true });

export const BlockchainTransaction = model<IBlockchainTransaction>(
  'BlockchainTransaction',
  blockchainTransactionSchema
);
