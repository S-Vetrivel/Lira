const fs = require("fs");
const path = require("path");
const minioClient = require("../config/minio");

const DEFAULT_BUCKET = process.env.MINIO_BUCKET_NAME || "icuman";

class MinioService {
  constructor() {
    this.client = minioClient;
    this.defaultBucket = DEFAULT_BUCKET;
    this._initialized = false;
  }

  /**
   * Ensure bucket exists on MinIO; creates it if missing.
   */
  async ensureBucket(bucketName = this.defaultBucket) {
    try {
      const exists = await this.client.bucketExists(bucketName);
      if (!exists) {
        console.log(`📦 Creating MinIO bucket '${bucketName}'...`);
        await this.client.makeBucket(bucketName, "us-east-1");
        console.log(`✅ MinIO bucket '${bucketName}' created successfully.`);
      } else {
        console.log(`✅ MinIO bucket '${bucketName}' verified ready.`);
      }
      this._initialized = true;
      return true;
    } catch (err) {
      console.error(`⚠️ MinIO ensureBucket failed for '${bucketName}':`, err.message);
      return false;
    }
  }

  /**
   * Upload a local file to MinIO
   */
  async uploadFile(objectKey, filePath, contentType = "application/octet-stream", bucket = this.defaultBucket) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      const metaData = {
        "Content-Type": contentType,
        "x-amz-meta-uploaded-at": new Date().toISOString(),
      };
      await this.client.fPutObject(bucket, objectKey, filePath, metaData);
      console.log(`☁️ [MinIO] Uploaded: ${bucket}/${objectKey}`);
      return {
        success: true,
        bucket,
        objectKey,
        url: `/v3/uploads/${objectKey}`,
      };
    } catch (err) {
      console.error(`❌ [MinIO] uploadFile error (${objectKey}):`, err.message);
      throw err;
    }
  }

  /**
   * Upload an in-memory Buffer to MinIO
   */
  async uploadBuffer(objectKey, buffer, contentType = "application/octet-stream", bucket = this.defaultBucket) {
    try {
      const metaData = {
        "Content-Type": contentType,
        "x-amz-meta-uploaded-at": new Date().toISOString(),
      };
      await this.client.putObject(bucket, objectKey, buffer, buffer.length, metaData);
      console.log(`☁️ [MinIO] Buffer uploaded: ${bucket}/${objectKey}`);
      return {
        success: true,
        bucket,
        objectKey,
        url: `/v3/uploads/${objectKey}`,
      };
    } catch (err) {
      console.error(`❌ [MinIO] uploadBuffer error (${objectKey}):`, err.message);
      throw err;
    }
  }

  /**
   * Get readable stream for an object
   */
  async getFileStream(objectKey, bucket = this.defaultBucket) {
    try {
      return await this.client.getObject(bucket, objectKey);
    } catch (err) {
      return null;
    }
  }

  /**
   * Generate Presigned Download URL (RFC 7233 & direct download)
   */
  async getPresignedUrl(objectKey, expirySeconds = 3600, bucket = this.defaultBucket) {
    try {
      return await this.client.presignedGetObject(bucket, objectKey, expirySeconds);
    } catch (err) {
      console.error(`❌ [MinIO] getPresignedUrl error (${objectKey}):`, err.message);
      return null;
    }
  }

  /**
   * Delete an object from MinIO
   */
  async deleteFile(objectKey, bucket = this.defaultBucket) {
    try {
      await this.client.removeObject(bucket, objectKey);
      console.log(`🗑️ [MinIO] Removed: ${bucket}/${objectKey}`);
      return true;
    } catch (err) {
      console.warn(`⚠️ [MinIO] deleteFile failed (${objectKey}):`, err.message);
      return false;
    }
  }

  /**
   * Health check
   */
  async checkHealth() {
    try {
      const buckets = await this.client.listBuckets();
      return {
        healthy: true,
        endpoint: `${process.env.MINIO_ENDPOINT || "127.0.0.1"}:${process.env.MINIO_PORT || 9000}`,
        defaultBucket: this.defaultBucket,
        bucketCount: buckets.length,
      };
    } catch (err) {
      return {
        healthy: false,
        error: err.message,
      };
    }
  }
}

module.exports = new MinioService();

