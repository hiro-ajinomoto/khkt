import dotenv from "dotenv";

dotenv.config();

/** Cùng key env với backend KHKT (`be/src/config.js`). */
export const config = {
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
    dbName: process.env.MONGODB_DB || "khkt_math_grader",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "bang-doanh-thu-dev-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
};
