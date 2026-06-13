// controllers/codeforces.controller.js — Request handlers for /api/codeforces
import cfApi from '../services/codeforces-api.service.js';
import { CodeforcesSyncService } from '../services/codeforces-sync.service.js';
import { CodeforcesRepository } from '../repositories/codeforces.repository.js';
import { validateCfHandle } from '../utils/validators.js';
import { createError } from '../middleware/errorHandler.js';
import { SYNC } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export const CodeforcesController = {
  /**
   * POST /api/codeforces/connect
   * Connects a Codeforces handle to the authenticated user.
   */
  async connect(req, res, next) {
    try {
      const handle = validateCfHandle(req.body.handle);

      // Check if user already has a profile
      const existing = await CodeforcesRepository.findProfileByUser(req.userId);
      if (existing) {
        throw createError(409, 'You already have a Codeforces profile linked. Disconnect it first.');
      }

      // Check if handle is already linked to another user
      const handleInUse = await CodeforcesRepository.findProfileByHandle(handle);
      if (handleInUse) {
        throw createError(409, `Handle "${handle}" is already linked to another account.`);
      }

      // Validate handle exists on Codeforces
      let cfUsers;
      try {
        cfUsers = await cfApi.getUserInfo(handle);
      } catch (err) {
        throw createError(400, `Codeforces handle "${handle}" not found. Check the spelling.`);
      }

      if (!cfUsers || cfUsers.length === 0) {
        throw createError(400, `Codeforces handle "${handle}" not found.`);
      }

      const cfUser = cfUsers[0];

      // Create the profile
      await CodeforcesRepository.createProfile(req.userId, {
        handle: cfUser.handle,
        rating: cfUser.rating,
        maxRating: cfUser.maxRating,
        rank: cfUser.rank,
        maxRank: cfUser.maxRank,
        avatar: cfUser.avatar,
        titlePhoto: cfUser.titlePhoto,
        contribution: cfUser.contribution,
        friendOfCount: cfUser.friendOfCount,
        registrationTimeSeconds: cfUser.registrationTimeSeconds,
      });

      // Kick off initial sync in the background (don't await)
      CodeforcesSyncService.initialSync(req.userId, cfUser.handle).catch(err => {
        logger.error('Background initial sync failed:', { error: err.message });
      });

      res.status(201).json({
        message: 'Profile connected! Initial sync started.',
        profile: {
          cf_handle: cfUser.handle,
          cf_rating: cfUser.rating || 0,
          cf_max_rating: cfUser.maxRating || 0,
          cf_rank: cfUser.rank || 'newbie',
          cf_avatar: cfUser.avatar,
          sync_status: 'syncing',
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/codeforces/profile
   * Gets the current user's linked Codeforces profile.
   */
  async getProfile(req, res, next) {
    try {
      const profile = await CodeforcesRepository.findProfileByUser(req.userId);

      if (!profile) {
        return res.json({ connected: false });
      }

      // Get submission stats
      const problemStats = await CodeforcesRepository.getUserProblemStats(req.userId);

      res.json({
        connected: true,
        profile: {
          cf_handle: profile.cf_handle,
          cf_rating: profile.cf_rating,
          cf_max_rating: profile.cf_max_rating,
          cf_rank: profile.cf_rank,
          cf_max_rank: profile.cf_max_rank,
          cf_avatar: profile.cf_avatar,
          cf_contribution: profile.cf_contribution,
          last_synced_at: profile.last_synced_at,
          sync_status: profile.sync_status,
          sync_error_message: profile.sync_error_message,
          total_submissions_synced: profile.total_submissions_synced,
          problems_solved: problemStats?.solved || 0,
          problems_attempted: problemStats?.attempted || 0,
          total_problems: problemStats?.total_problems || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/codeforces/sync
   * Manually triggers an incremental re-sync.
   */
  async sync(req, res, next) {
    try {
      const profile = await CodeforcesRepository.findProfileByUser(req.userId);

      if (!profile) {
        throw createError(404, 'No Codeforces profile linked. Connect one first.');
      }

      if (profile.sync_status === 'syncing') {
        throw createError(429, 'A sync is already in progress. Please wait.');
      }

      // Enforce minimum gap between syncs
      if (profile.last_synced_at) {
        const elapsed = Date.now() - new Date(profile.last_synced_at).getTime();
        if (elapsed < SYNC.MIN_SYNC_GAP_MS) {
          const waitSec = Math.ceil((SYNC.MIN_SYNC_GAP_MS - elapsed) / 1000);
          throw createError(429, `Please wait ${waitSec} seconds before syncing again.`);
        }
      }

      // Start incremental sync in background
      CodeforcesSyncService.incrementalSync(req.userId, profile.cf_handle).catch(err => {
        logger.error('Background incremental sync failed:', { error: err.message });
      });

      res.json({ message: 'Sync started.', sync_status: 'syncing' });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/codeforces/disconnect
   * Unlinks the CF profile and deletes all synced data.
   */
  async disconnect(req, res, next) {
    try {
      const profile = await CodeforcesRepository.findProfileByUser(req.userId);

      if (!profile) {
        throw createError(404, 'No Codeforces profile linked.');
      }

      await CodeforcesRepository.deleteProfile(req.userId);

      res.json({ message: 'Codeforces profile disconnected. All synced data has been removed.' });
    } catch (error) {
      next(error);
    }
  },
};
