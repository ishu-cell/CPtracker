// config/database.js — MySQL connection pool factory
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cp_tracker',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
  queueLimit: 0,
  // Prevent stale connections
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

/**
 * Test the database connection on startup.
 * Logs success or failure — does not throw.
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Successfully connected to MySQL Database!');
    connection.release();
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to MySQL Database:', err.message);
    return false;
  }
}

export { pool, testConnection };
