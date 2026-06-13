// services/codeforces-sync.service.js — Orchestrates Codeforces data synchronization
// Coordinates calls to the CF API and writes results to the database.

import cfApi from './codeforces-api.service.js';
import { WeaknessService } from './weakness.service.js';
import { CodeforcesRepository } from '../repositories/codeforces.repository.js';
import { logger } from '../utils/logger.js';

export const CodeforcesSyncService = {
  /**
   * Full initial sync for a newly connected user.
   * Fetches profile, rating history, and all submissions.
   * Runs asynchronously — don't await in the request handler.
   */
  async initialSync(userId, cfHandle) {
    logger.info(`Starting initial sync for ${cfHandle} (user: ${userId})`);

    try {
      await CodeforcesRepository.updateSyncStatus(userId, 'syncing');

      // 1. Sync profile (already done during connect, but refresh)
      await this.syncProfile(userId, cfHandle);

      // 2. Sync contest participation (rating history)
      await this.syncContestHistory(userId, cfHandle);

      // 3. Sync all submissions (can be large — thousands of submissions)
      await this.syncAllSubmissions(userId, cfHandle);

      // 4. Rebuild denormalized tables
      await CodeforcesRepository.rebuildUserProblemStatus(userId);

      // 5. Rebuild tag stats & weakness scores
      await WeaknessService.rebuildTagStats(userId);

      // 6. Mark sync complete
      await CodeforcesRepository.updateSyncStatus(userId, 'idle');
      logger.info(`Initial sync complete for ${cfHandle}`);
    } catch (err) {
      logger.error(`Initial sync failed for ${cfHandle}:`, { error: err.message });
      await CodeforcesRepository.updateSyncStatus(userId, 'error', err.message);
    }
  },

  /**
   * Incremental sync — only fetches new data since last sync.
   * Called periodically by the scheduler.
   */
  async incrementalSync(userId, cfHandle) {
    logger.info(`Incremental sync for ${cfHandle}`);

    try {
      await CodeforcesRepository.updateSyncStatus(userId, 'syncing');

      // 1. Refresh profile
      await this.syncProfile(userId, cfHandle);

      // 2. Refresh contest history (lightweight — small array)
      await this.syncContestHistory(userId, cfHandle);

      // 3. Fetch only new submissions
      await this.syncNewSubmissions(userId, cfHandle);

      // 4. Rebuild denormalized tables
      await CodeforcesRepository.rebuildUserProblemStatus(userId);

      // 5. Rebuild tag stats & weakness scores
      await WeaknessService.rebuildTagStats(userId);

      await CodeforcesRepository.updateSyncStatus(userId, 'idle');
      logger.info(`Incremental sync complete for ${cfHandle}`);
    } catch (err) {
      logger.error(`Incremental sync failed for ${cfHandle}:`, { error: err.message });
      await CodeforcesRepository.updateSyncStatus(userId, 'error', err.message);
    }
  },

  /**
   * Sync profile info from user.info endpoint.
   */
  async syncProfile(userId, cfHandle) {
    const users = await cfApi.getUserInfo(cfHandle);
    if (!users || users.length === 0) {
      throw new Error(`Handle "${cfHandle}" not found on Codeforces.`);
    }
    const u = users[0];
    await CodeforcesRepository.updateProfile(userId, {
      rating: u.rating,
      maxRating: u.maxRating,
      rank: u.rank,
      maxRank: u.maxRank,
      avatar: u.avatar,
      titlePhoto: u.titlePhoto,
      contribution: u.contribution,
      friendOfCount: u.friendOfCount,
    });
  },

  /**
   * Sync contest participation (rating changes).
   */
  async syncContestHistory(userId, cfHandle) {
    const ratingChanges = await cfApi.getUserRating(cfHandle);

    for (const rc of ratingChanges) {
      // Ensure the contest exists in our contests table
      await CodeforcesRepository.upsertContest({
        id: rc.contestId,
        name: rc.contestName,
        type: 'CF',
        phase: 'FINISHED',
        startTimeSeconds: rc.ratingUpdateTimeSeconds,
      });

      // Upsert the participation record
      await CodeforcesRepository.upsertContestParticipation(userId, cfHandle, rc);
    }

    logger.info(`  Synced ${ratingChanges.length} contest participations for ${cfHandle}`);
  },

  /**
   * Sync ALL submissions for a user (initial sync).
   * CF API returns submissions newest-first. We process in batches.
   */
  async syncAllSubmissions(userId, cfHandle) {
    let from = 1;
    const batchSize = 1000;
    let totalSynced = 0;

    while (true) {
      const submissions = await cfApi.getUserStatus(cfHandle, from, batchSize);

      if (!submissions || submissions.length === 0) break;

      for (const sub of submissions) {
        await CodeforcesRepository.upsertSubmission(userId, cfHandle, sub);
      }

      totalSynced += submissions.length;
      logger.info(`  Synced ${totalSynced} submissions for ${cfHandle}...`);

      await CodeforcesRepository.updateSubmissionCount(userId, totalSynced);

      if (submissions.length < batchSize) break;
      from += batchSize;
    }

    logger.info(`  Total submissions synced: ${totalSynced} for ${cfHandle}`);
  },

  /**
   * Sync only NEW submissions since the last known submission.
   * Uses the creation_time_seconds of the latest stored submission as a watermark.
   */
  async syncNewSubmissions(userId, cfHandle) {
    const latestTime = await CodeforcesRepository.getLatestSubmissionTime(userId);

    // Fetch recent submissions (first 500 — should cover any gap)
    const submissions = await cfApi.getUserStatus(cfHandle, 1, 500);

    if (!submissions || submissions.length === 0) return;

    let newCount = 0;
    for (const sub of submissions) {
      // Skip submissions we already have (by time watermark)
      if (latestTime && sub.creationTimeSeconds <= latestTime) continue;
      await CodeforcesRepository.upsertSubmission(userId, cfHandle, sub);
      newCount++;
    }

    if (newCount > 0) {
      const total = await CodeforcesRepository.getSubmissionCount(userId);
      await CodeforcesRepository.updateSubmissionCount(userId, total);
      logger.info(`  ${newCount} new submissions synced for ${cfHandle}`);
    }
  },

  /**
   * Sync the global problemset.
   * This is shared across all users — run once every 6 hours.
   */
  async syncGlobalProblemset() {
    logger.info('Syncing global problemset from Codeforces...');

    const data = await cfApi.getProblemset();
    const { problems, problemStatistics } = data;

    // Build a solved-count lookup
    const solvedCountMap = new Map();
    for (const stat of problemStatistics) {
      const key = `${stat.contestId}-${stat.index}`;
      solvedCountMap.set(key, stat.solvedCount);
    }

    let count = 0;
    for (const p of problems) {
      const key = `${p.contestId}-${p.index}`;
      const solvedCount = solvedCountMap.get(key) || 0;
      await CodeforcesRepository.upsertProblem(p, solvedCount);
      count++;
    }

    logger.info(`Global problemset synced: ${count} problems`);
    return count;
  },
};
