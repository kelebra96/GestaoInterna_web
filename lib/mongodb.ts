
import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'myinventory-dev';

// Extend global to include _mongoClient
declare global {
  var _mongoClient: Promise<MongoClient> | undefined;
}

let client: MongoClient;
let db: Db;

export async function connectToDatabase() {
  if (db) {
    return { db, client };
  }

  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!global._mongoClient) {
      client = new MongoClient(MONGODB_URI);
      global._mongoClient = client.connect();
    }
    client = await global._mongoClient;
  } else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }

  db = client.db(MONGODB_DB);

  return { db, client };
}
