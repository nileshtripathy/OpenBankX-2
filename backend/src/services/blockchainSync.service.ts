import { EventEmitter } from 'events';
import { ethers, EventLog } from 'ethers';
import { provider, getVaultContract, getSwapContract } from '../config/blockchain';
import { env } from '../config/env';
import { BlockchainTransaction, IBlockchainTransaction } from '../models/BlockchainTransaction';
import { SyncState } from '../models/SyncState';
import { cacheDel } from '../utils/cache';
import { balanceCacheKey } from './blockchain.service';
import { emitToWallet } from '../realtime/socket';

/** Emits 'tx' with the newly-indexed transaction doc - the SSE route (and the socket.io bridge) subscribe to this. */
export const txEvents = new EventEmitter();

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Invalidate cached balances for every token/kind combo touched by this event, and push it to any connected sockets. */
function invalidateAndBroadcast(doc: IBlockchainTransaction) {
  const tokens = [doc.tokenInAddress, doc.tokenOutAddress, ZERO_ADDRESS].filter(
    (t): t is string => Boolean(t)
  );
  const wallets = [doc.walletAddress, doc.counterpartyAddress].filter(
    (w): w is string => Boolean(w)
  );

  for (const wallet of wallets) {
    for (const token of tokens) {
      void cacheDel(balanceCacheKey('vault', wallet, token));
      void cacheDel(balanceCacheKey('wallet', wallet, token));
    }
    emitToWallet(wallet, 'blockchain:tx', doc);
  }
}

interface ParsedEvent {
  eventType: 'deposit' | 'withdraw' | 'transfer' | 'swap';
  walletAddress: string;
  counterpartyAddress?: string;
  tokenInAddress?: string;
  tokenOutAddress?: string;
  amountIn?: string;
  amountOut?: string;
}

function parseVaultLog(eventName: string, args: ethers.Result): ParsedEvent | null {
  switch (eventName) {
    case 'Deposited':
      return {
        eventType: 'deposit',
        walletAddress: args[0] as string,
        tokenInAddress: args[1] as string,
        amountIn: (args[2] as bigint).toString(),
      };
    case 'Withdrawn':
      return {
        eventType: 'withdraw',
        walletAddress: args[0] as string,
        tokenInAddress: args[1] as string,
        amountIn: (args[2] as bigint).toString(),
      };
    case 'Transferred':
      return {
        eventType: 'transfer',
        walletAddress: args[0] as string,
        counterpartyAddress: args[1] as string,
        tokenInAddress: args[2] as string,
        amountIn: (args[3] as bigint).toString(),
      };
    default:
      return null;
  }
}

function parseSwapLog(eventName: string, args: ethers.Result): ParsedEvent | null {
  if (eventName !== 'Swapped') return null;
  return {
    eventType: 'swap',
    walletAddress: args[0] as string,
    tokenInAddress: args[1] as string,
    tokenOutAddress: args[2] as string,
    amountIn: (args[3] as bigint).toString(),
    amountOut: (args[4] as bigint).toString(),
  };
}

const blockTimestampCache = new Map<number, Date>();
async function getBlockTimestamp(blockNumber: number): Promise<Date> {
  const cached = blockTimestampCache.get(blockNumber);
  if (cached) return cached;
  const block = await provider.getBlock(blockNumber);
  const ts = block ? new Date(block.timestamp * 1000) : new Date();
  blockTimestampCache.set(blockNumber, ts);
  return ts;
}

async function upsertLog(
  contractName: 'vault' | 'swap',
  log: EventLog,
  parsed: ParsedEvent
): Promise<IBlockchainTransaction | null> {
  const blockTimestamp = await getBlockTimestamp(log.blockNumber);

  const doc = await BlockchainTransaction.findOneAndUpdate(
    { txHash: log.transactionHash, logIndex: log.index },
    {
      txHash: log.transactionHash,
      logIndex: log.index,
      contractName,
      eventType: parsed.eventType,
      walletAddress: parsed.walletAddress.toLowerCase(),
      counterpartyAddress: parsed.counterpartyAddress?.toLowerCase(),
      tokenInAddress: parsed.tokenInAddress?.toLowerCase(),
      tokenOutAddress: parsed.tokenOutAddress?.toLowerCase(),
      amountIn: parsed.amountIn,
      amountOut: parsed.amountOut,
      blockNumber: log.blockNumber,
      blockTimestamp,
      status: 'confirmed',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
}

async function backfillContract(
  contractName: 'vault' | 'swap',
  contract: ethers.Contract,
  eventNames: string[],
  parser: (eventName: string, args: ethers.Result) => ParsedEvent | null
) {
  const currentBlock = await provider.getBlockNumber();
  const state = await SyncState.findOne({ contractName });
  const fromBlock = state
    ? state.lastProcessedBlock + 1
    : Math.max(0, currentBlock - env.blockchain.backfillBlockRange);

  if (fromBlock > currentBlock) return; // already caught up

  console.log(`[blockchain] backfilling ${contractName} from block ${fromBlock} to ${currentBlock}`);

  for (const eventName of eventNames) {
    const filter = contract.filters[eventName]();
    const logs = (await contract.queryFilter(filter, fromBlock, currentBlock)) as EventLog[];
    for (const log of logs) {
      const parsed = parser(eventName, log.args as unknown as ethers.Result);
      if (parsed) await upsertLog(contractName, log, parsed);
    }
    console.log(`[blockchain] ${contractName}.${eventName}: indexed ${logs.length} past event(s)`);
  }

  await SyncState.findOneAndUpdate(
    { contractName },
    { contractName, lastProcessedBlock: currentBlock },
    { upsert: true }
  );
}

function subscribeLive(
  contractName: 'vault' | 'swap',
  contract: ethers.Contract,
  eventNames: string[],
  parser: (eventName: string, args: ethers.Result) => ParsedEvent | null
) {
  for (const eventName of eventNames) {
    contract.on(eventName, async (...allArgs: unknown[]) => {
      // Last arg in ethers v6 listener callbacks is the ContractEventPayload,
      // which carries the underlying log.
      const payload = allArgs[allArgs.length - 1] as { log: EventLog };
      const log = payload.log;
      const parsed = parser(eventName, log.args as unknown as ethers.Result);
      if (!parsed) return;

      try {
        const doc = await upsertLog(contractName, log, parsed);
        if (doc) {
          txEvents.emit('tx', doc);
          invalidateAndBroadcast(doc);
          await SyncState.findOneAndUpdate(
            { contractName },
            { contractName, lastProcessedBlock: log.blockNumber },
            { upsert: true }
          );
        }
      } catch (err) {
        console.error(`[blockchain] failed to index live ${contractName}.${eventName}:`, err);
      }
    });
  }
  console.log(`[blockchain] subscribed to live events: ${contractName} [${eventNames.join(', ')}]`);
}

/** Call once on server startup. No-ops gracefully if contract addresses aren't configured yet. */
export async function initBlockchainSync(): Promise<void> {
  if (!env.blockchain.vaultAddress || !env.blockchain.swapAddress) {
    console.warn(
      '[blockchain] VAULT_CONTRACT_ADDRESS / SWAP_CONTRACT_ADDRESS not set - skipping blockchain sync'
    );
    return;
  }

  try {
    await provider.getBlockNumber();
  } catch (err) {
    console.error('[blockchain] could not reach RPC_URL, skipping sync:', (err as Error).message);
    return;
  }

  const vault = getVaultContract();
  const swap = getSwapContract();

  const vaultEvents = ['Deposited', 'Withdrawn', 'Transferred'];
  const swapEvents = ['Swapped'];

  await backfillContract('vault', vault, vaultEvents, parseVaultLog);
  await backfillContract('swap', swap, swapEvents, parseSwapLog);

  subscribeLive('vault', vault, vaultEvents, parseVaultLog);
  subscribeLive('swap', swap, swapEvents, parseSwapLog);
}
