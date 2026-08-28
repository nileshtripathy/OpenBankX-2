import cron, { ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import { BankAccount } from '../models/BankAccount';
import { BankService } from '../services/bank.service';
import { SyncState } from '../models/SyncState';
import { provider } from '../config/blockchain';

const tasks: ScheduledTask[] = [];

/**
 * Refreshes balances for every actively-linked bank account, grouped by
 * user, so users see up-to-date numbers even if they never click "refresh"
 * or reopen the app. Runs on a schedule (default: every 6h) rather than on
 * every page load, since provider calls (Plaid/mock) are rate-limited and
 * relatively slow - this is exactly the kind of background work cron jobs
 * exist for.
 */
async function refreshAllBankBalances(): Promise<void> {
  const rawIds = await BankAccount.distinct('userId', { status: 'active' });
  const userIds = rawIds.map((id) => String(id));
  if (userIds.length === 0) return;

  console.log(`[cron] refreshing bank balances for ${userIds.length} user(s)`);
  let ok = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      await BankService.refreshBalances(userId);
      ok++;
    } catch (err) {
      failed++;
      console.error(`[cron] balance refresh failed for user ${userId}:`, (err as Error).message);
    }
  }

  console.log(`[cron] bank balance refresh complete: ${ok} succeeded, ${failed} failed`);
}

/**
 * Lightweight liveness check for the blockchain indexer: compares the last
 * block we've processed against the chain's current head. A growing gap
 * usually means the RPC provider is down or the event listener silently
 * died - this surfaces that in logs well before a user notices stale data.
 */
async function checkBlockchainSyncHealth(): Promise<void> {
  if (!env.blockchain.vaultAddress) return; // sync intentionally disabled, nothing to check

  try {
    const [currentBlock, states] = await Promise.all([
      provider.getBlockNumber(),
      SyncState.find({}),
    ]);

    for (const state of states) {
      const lag = currentBlock - state.lastProcessedBlock;
      if (lag > 50) {
        console.warn(
          `[cron] blockchain sync for "${state.contractName}" is ${lag} blocks behind (at ${state.lastProcessedBlock}, chain at ${currentBlock})`
        );
      }
    }
  } catch (err) {
    console.error('[cron] blockchain health check could not reach RPC:', (err as Error).message);
  }
}

export function startScheduledJobs(): void {
  if (!env.cron.enabled) {
    console.log('[cron] scheduled jobs disabled via CRON_ENABLED=false');
    return;
  }

  tasks.push(
    cron.schedule(env.cron.bankRefreshSchedule, () => {
      refreshAllBankBalances().catch((err) =>
        console.error('[cron] unhandled error in bank refresh job:', err)
      );
    })
  );

  tasks.push(
    cron.schedule(env.cron.healthCheckSchedule, () => {
      checkBlockchainSyncHealth().catch((err) =>
        console.error('[cron] unhandled error in health check job:', err)
      );
    })
  );

  console.log(
    `[cron] scheduled jobs started (bank refresh: "${env.cron.bankRefreshSchedule}", health check: "${env.cron.healthCheckSchedule}")`
  );
}

export function stopScheduledJobs(): void {
  for (const task of tasks) task.stop();
  tasks.length = 0;
}

// Exported for tests / manual triggering (e.g. an admin "sync now" endpoint).
export const jobs = { refreshAllBankBalances, checkBlockchainSyncHealth };
