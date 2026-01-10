import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";
import fs from "fs";

// Validate AWS config
function validateAWSConfig() {
  if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
    throw new Error(
      "AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env file"
    );
  }
  if (!config.aws.bucketName) {
    throw new Error(
      "AWS S3 bucket name not configured. Please set AWS_S3_BUCKET_NAME in .env file"
    );
  }
}

// Initialize S3 client
let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    validateAWSConfig();
    s3Client = new S3Client({
      region: config.aws.region || "us-east-1",
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });
  }
  return s3Client;
}

/**
 * Upload file to S3
 * @param {string} filePath - Local file path to upload
 * @param {string} key - S3 object key (path in bucket)
 * @param {string} contentType - MIME type (e.g., 'image/png')
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadFileToS3(filePath, key, contentType = "image/png") {
  try {
    const fileContent = fs.readFileSync(filePath);
    const client = getS3Client();

    const command = new PutObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
    });

    await client.send(command);

    // Return S3 URL
    const region = config.aws.region || "us-east-1";
    return `https://${config.aws.bucketName}.s3.${region}.amazonaws.com/${key}`;
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    throw error;
  }
}

/**
 * Upload file buffer to S3
 * @param {Buffer} buffer - File buffer
 * @param {string} key - S3 object key (path in bucket)
 * @param {string} contentType - MIME type (e.g., 'image/png')
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadBufferToS3(buffer, key, contentType = "image/png") {
  try {
    const client = getS3Client();

    const command = new PutObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await client.send(command);

    // Return S3 URL
    const region = config.aws.region || "us-east-1";
    return `https://${config.aws.bucketName}.s3.${region}.amazonaws.com/${key}`;
  } catch (error) {
    console.error("Error uploading buffer to S3:", error);
    throw error;
  }
}

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
export async function deleteFileFromS3(key) {
  try {
    const client = getS3Client();

    const command = new DeleteObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
    });

    await client.send(command);
  } catch (error) {
    console.error("Error deleting file from S3:", error);
    throw error;
  }
}

/**
 * Get presigned URL for S3 object (for temporary access)
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  try {
    const client = getS3Client();

    const command = new GetObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
    });

    return await getSignedUrl(client, command, { expiresIn });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw error;
  }
}

/**
 * Extract S3 key from S3 URL (handles both base URLs and presigned URLs)
 * @param {string} s3Url - Full S3 URL (base or presigned)
 * @returns {string|null} S3 key or null
 */
export function extractS3Key(s3Url) {
  if (!s3Url) return null;

  // Remove query parameters if present (presigned URL)
  const urlWithoutQuery = s3Url.split('?')[0];
  
  // Match S3 URL pattern: https://bucket-name.s3.region.amazonaws.com/key
  const match = urlWithoutQuery.match(/https:\/\/[^/]+\.s3[^/]*\.amazonaws\.com\/(.+)/);
  if (match) {
    // Decode the key (it might be URL encoded)
    const key = match[1];
    try {
      return decodeURIComponent(key);
    } catch (e) {
      // If decoding fails, return as is
      return key;
    }
  }

  // If it's already a key (no https://), return as is
  if (!s3Url.startsWith("http")) {
    return s3Url;
  }

  return null;
}
