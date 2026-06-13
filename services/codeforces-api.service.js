// services/codeforces-api.service.js — Rate-limited Codeforces API client
// Queues all requests and throttles to 4 req/sec (CF limit is 5, we keep headroom).

import { CF_API } from '../config/constants.js';
import { logger } from '../utils/logger.js';

class CodeforcesApiService {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.requestsThisSecond = 0;
    this.lastResetTime = Date.now();
  }

  /**
   * Enqueue a Codeforces API request.
   * @param {string} method — e.g. 'user.info'
   * @param {object} params — query parameters
   * @returns {Promise<any>} — the `result` field from the CF API response
   */
  async request(method, params = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({ method, params, resolve, reject });
      this._processQueue();
    });
  }

  async _processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Rate limit: reset counter every second
      const now = Date.now();
      if (now - this.lastResetTime >= 1000) {
        this.requestsThisSecond = 0;
        this.lastResetTime = now;
      }

      // Wait if we've hit the per-second limit
      if (this.requestsThisSecond >= CF_API.MAX_REQUESTS_PER_SECOND) {
        const waitMs = 1000 - (now - this.lastResetTime) + 50; // +50ms buffer
        await this._sleep(waitMs);
        this.requestsThisSecond = 0;
        this.lastResetTime = Date.now();
      }

      const { method, params, resolve, reject } = this.queue.shift();

      try {
        const url = new URL(`${CF_API.BASE_URL}/${method}`);
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            url.searchParams.set(k, String(v));
          }
        });

        logger.debug(`CF API → ${method}`, params);

        const response = await fetch(url.toString());
        const data = await response.json();
        this.requestsThisSecond++;

        if (data.status === 'FAILED') {
          const errMsg = data.comment || 'Unknown Codeforces API error';
          logger.warn(`CF API error: ${method} → ${errMsg}`);
          reject(new Error(errMsg));
        } else {
          resolve(data.result);
        }
      } catch (err) {
        logger.error(`CF API fetch failed: ${method}`, { error: err.message });
        reject(err);
      }
    }

    this.processing = false;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Convenience Methods ──

  /**
   * Get user profile info. Supports multiple handles (semicolon-separated).
   * @returns {Promise<Array>} — array of User objects
   */
  async getUserInfo(handles) {
    const handleStr = Array.isArray(handles) ? handles.join(';') : handles;
    return this.request(CF_API.ENDPOINTS.USER_INFO, { handles: handleStr });
  }

  /**
   * Get rating history for a user.
   * @returns {Promise<Array>} — array of RatingChange objects
   */
  async getUserRating(handle) {
    return this.request(CF_API.ENDPOINTS.USER_RATING, { handle });
  }

  /**
   * Get submission history for a user.
   * @param {string} handle
   * @param {number} [from] — 1-based index to start from
   * @param {number} [count] — number of submissions to return
   * @returns {Promise<Array>} — array of Submission objects
   */
  async getUserStatus(handle, from, count) {
    const params = { handle };
    if (from !== undefined) params.from = from;
    if (count !== undefined) params.count = count;
    return this.request(CF_API.ENDPOINTS.USER_STATUS, params);
  }

  /**
   * Get the full problemset (all problems on CF).
   * @returns {Promise<{problems: Array, problemStatistics: Array}>}
   */
  async getProblemset() {
    return this.request(CF_API.ENDPOINTS.PROBLEMSET_PROBLEMS);
  }

  /**
   * Get the list of all contests.
   * @returns {Promise<Array>} — array of Contest objects
   */
  async getContestList() {
    return this.request(CF_API.ENDPOINTS.CONTEST_LIST);
  }
}

// Singleton — one queue for the entire process
const cfApi = new CodeforcesApiService();
export default cfApi;
