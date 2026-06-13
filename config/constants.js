// config/constants.js — Application-wide constants

export const APP = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NAME: 'Σcp.track',
  VERSION: '2.0.0',
};

// ── Codeforces API ──
export const CF_API = {
  BASE_URL: 'https://codeforces.com/api',
  MAX_REQUESTS_PER_SECOND: 4,   // CF limit is 5, we keep 1 as headroom
  ENDPOINTS: {
    USER_INFO: 'user.info',
    USER_RATING: 'user.rating',
    USER_STATUS: 'user.status',
    PROBLEMSET_PROBLEMS: 'problemset.problems',
    CONTEST_LIST: 'contest.list',
  },
};

// ── Sync intervals (milliseconds) ──
export const SYNC = {
  PROFILE_INTERVAL_MS: 30 * 60 * 1000,       // 30 minutes
  PROBLEMSET_INTERVAL_MS: 6 * 60 * 60 * 1000, // 6 hours
  MIN_SYNC_GAP_MS: 30 * 1000,                 // 30 sec cooldown for testing (set to 5 * 60 * 1000 for production)
};

// ── Codeforces rating tiers ──
export const CF_RANKS = [
  { name: 'newbie',                  minRating: 0,    maxRating: 1199, color: '#808080' },
  { name: 'pupil',                   minRating: 1200, maxRating: 1399, color: '#008000' },
  { name: 'specialist',             minRating: 1400, maxRating: 1599, color: '#03a89e' },
  { name: 'expert',                 minRating: 1600, maxRating: 1899, color: '#0000ff' },
  { name: 'candidate master',       minRating: 1900, maxRating: 2099, color: '#aa00aa' },
  { name: 'master',                 minRating: 2100, maxRating: 2299, color: '#ff8c00' },
  { name: 'international master',   minRating: 2300, maxRating: 2399, color: '#ff8c00' },
  { name: 'grandmaster',            minRating: 2400, maxRating: 2599, color: '#ff0000' },
  { name: 'international grandmaster', minRating: 2600, maxRating: 2999, color: '#ff0000' },
  { name: 'legendary grandmaster',  minRating: 3000, maxRating: 9999, color: '#aa0000' },
];

// ── Recommendation engine defaults ──
export const RECOMMENDATION = {
  DEFAULT_COUNT: 10,
  MAX_COUNT: 50,
  CANDIDATE_POOL_SIZE: 500,
  MAX_PER_TAG: 3,              // Diversity: max problems per tag in results
  DIFFICULTY_OFFSETS: {
    // Range = [user_rating + offset, user_rating + offset + 200]
    easy: -200,              // [rating-200, rating]       — consolidate fundamentals
    medium: 0,               // [rating, rating+200]       — push comfort zone
    hard: 100,               // [rating+100, rating+300]   — challenging stretch
    stretch: 200,            // [rating+200, rating+400]   — maximum growth
    balanced: 0,             // [rating, rating+200]       — sweet spot for improvement
    weakness_focus: -100,    // [rating-100, rating+100]   — fix gaps near your level
    contest_prep: 0,         // [rating, rating+200]       — simulate contest difficulty
  },
  WEIGHTS: {
    balanced: {
      difficulty: 0.35,
      weakness: 0.30,
      freshness: 0.15,
      popularity: 0.10,
      staleness: 0.10,
    },
    weakness_focus: {
      difficulty: 0.20,
      weakness: 0.55,
      freshness: 0.10,
      popularity: 0.05,
      staleness: 0.10,
    },
    stretch: {
      difficulty: 0.45,
      weakness: 0.20,
      freshness: 0.15,
      popularity: 0.10,
      staleness: 0.10,
    },
    contest_prep: {
      difficulty: 0.30,
      weakness: 0.15,
      freshness: 0.05,
      popularity: 0.20,
      staleness: 0.30,
    },
  },
};

// ── Daily training ──
export const TRAINING = {
  MAX_STREAK_GAP_DAYS: 1,       // Miss 1 day = streak resets
  DIFFICULTY_MODES: ['easy', 'medium', 'hard', 'stretch'],
  DEFAULT_MODE: 'medium',
};
