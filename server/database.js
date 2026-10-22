
const { MongoClient } = require("mongodb");

let client;
let db;

async function connectDatabase() {
  // Reuse the existing connection if already connected
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is missing from the server/.env file"
    );
  }

  client = new MongoClient(uri);

  try {
    await client.connect();

    // Select the StudyPilot AI database
    db = client.db("studypilot");

    // Verify that the database is reachable
    await db.command({ ping: 1 });

    // Create an index for subject lookups
    await db.collection("subjects").createIndex({ name: 1 });

    console.log("MongoDB connected successfully");

    return db;
  } catch (error) {
    await client.close().catch(() => {});
    client = undefined;
    db = undefined;

    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
}

function getDatabase() {
  if (!db) {
    throw new Error(
      "Database is not connected. Call connectDatabase() first."
    );
  }

  return db;
}

async function closeDatabase() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
    console.log("MongoDB connection closed");
  }
}

module.exports = {
  connectDatabase,
  getDatabase,
  closeDatabase,
};
