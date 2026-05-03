import dotenv from "dotenv";

dotenv.config();

/** Cùng key env với backend KHKT (`be/src/config.js`). */
export const config = {
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
    dbName: process.env.MONGODB_DB || "khkt_math_grader",
  },
};
