import { MongoClient } from "mongodb";
import { config } from "./config.js";

const COLL = "bang_doanh_thu_sheets";
const PEOPLE_COLL = "bang_doanh_thu_people";

let client = null;
let db = null;

export async function connectDB() {
  if (db) return db;

  client = new MongoClient(config.mongodb.uri);
  client.on("error", (err) => {
    console.error("MongoDB client error:", err);
  });
  await client.connect();
  db = client.db(config.mongodb.dbName);
  await db.collection(COLL).createIndex({ reportDate: 1 }, { unique: true });
  await db.collection(COLL).createIndex(
    { year: 1, month: 1, reportDate: -1 },
    { name: "bdt_calendar_idx" },
  );
  await db.collection(COLL).createIndex(
    { isoWeekYear: 1, isoWeek: 1, reportDate: -1 },
    { name: "bdt_isoweek_idx" },
  );
  await db.collection(PEOPLE_COLL).createIndex(
    { nameNorm: 1 },
    { unique: true, name: "bdt_people_nameNorm_u" },
  );
  console.log(`MongoDB: db=${config.mongodb.dbName} collection=${COLL}, ${PEOPLE_COLL}`);
  return db;
}

export function getDB() {
  if (!db) throw new Error("Database not connected. Call connectDB() first.");
  return db;
}

export function getSheetsCollection() {
  return getDB().collection(COLL);
}

export function getPeopleCollection() {
  return getDB().collection(PEOPLE_COLL);
}

export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
