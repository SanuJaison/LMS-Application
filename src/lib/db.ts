import mongoose from 'mongoose';

// Support both MONGODB_URL and MONGODB_URI environment variables
const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  console.warn('⚠️ Warning: MONGODB_URL or MONGODB_URI is not set in environment variables.');
}

// Global cache for Next.js hot-reloads / serverless warm containers
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

/**
 * Connect to MongoDB with caching for Next.js / Vercel serverless.
 *
 * Key fix: `bufferCommands` is intentionally left at the default (true) so
 * mongoose can queue queries while the connection is being established.
 * Setting it to false caused "Cannot call X before initial connection is
 * complete" errors on cold starts in serverless environments.
 */
export async function connectDB(): Promise<typeof mongoose> {
  // Already fully connected — reuse.
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // A cached, resolved connection exists — reuse.
  if (cached!.conn) {
    return cached!.conn;
  }

  // Start connecting if not already in progress.
  if (!cached!.promise) {
    const opts: mongoose.ConnectOptions = {
      // Do NOT set bufferCommands: false — that breaks serverless cold starts.
      serverSelectionTimeoutMS: 10000, // 10 s timeout for server selection
      socketTimeoutMS: 45000,          // 45 s socket timeout
    };

    cached!.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        console.log('✅ MongoDB Connected Successfully');
        return mongooseInstance;
      })
      .catch((error) => {
        // Reset so the next invocation retries.
        cached!.promise = null;
        console.error('❌ MongoDB Connection Failed:', error);
        throw error;
      });
  }

  cached!.conn = await cached!.promise;
  return cached!.conn;
}

// Aliases for backwards compatibility and easy importing
export const connection = connectDB;
export const connectToDatabase = connectDB;
export default connectDB;
