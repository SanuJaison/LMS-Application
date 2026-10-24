import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';

/**
 * Server and Database Health Utility
 * You can call this helper from any Next.js API route to verify connection state.
 */
export async function checkServerStatus() {
  try {
    await connectDB();
    const isConnected = mongoose.connection.readyState === 1;
    const dbName = mongoose.connection.db?.databaseName || 'unknown';

    return {
      success: true,
      status: 'Server & Database Online',
      database: dbName,
      connected: isConnected,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      success: false,
      status: 'Database Connection Error',
      error: error.message || 'Unknown database error',
      timestamp: new Date().toISOString(),
    };
  }
}

export default checkServerStatus;
