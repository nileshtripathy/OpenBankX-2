import { Schema, model, Document } from 'mongoose';

export interface ISyncState extends Document {
  contractName: 'vault' | 'swap';
  lastProcessedBlock: number;
  updatedAt: Date;
}

const syncStateSchema = new Schema<ISyncState>(
  {
    contractName: { type: String, enum: ['vault', 'swap'], required: true, unique: true },
    lastProcessedBlock: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export const SyncState = model<ISyncState>('SyncState', syncStateSchema);
