import mongoose from 'mongoose';

// Support both MONGODB_URL and MONGODB_URI environment variables
const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  console.warn('⚠️ Warning: MONGODB_URL or MONGODB_URI is not set in environment variables.');
}

// Global cache for Next.js hot-reloads to prevent multiple connections
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
 * Connect to MongoDB with caching for Next.js
 */
export async function connectDB(): Promise<typeof mongoose> {
  // If already connected, reuse existing connection
  if (mongoose.connection.readyState >= 1) {
    return mongoose;
  }

  if (cached?.conn) {
    return cached.conn;
  }

  if (!cached!.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      console.log('✅ MongoDB Connected Successfully');
      return mongooseInstance;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (error) {
    cached!.promise = null;
    console.error('❌ MongoDB Connection Failed:', error);
    throw error;
  }

  return cached!.conn;
}

// Aliases for backwards compatibility and easy importing
export const connection = connectDB;
export const connectToDatabase = connectDB;
export default connectDB;
