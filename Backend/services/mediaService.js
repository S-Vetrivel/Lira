const { mediaQueue } = require("./queue");

/**
 * Adds a file to the processing queue
 * @param {Object} file - Multer file object
 * @param {String} dbId - The ID of the document created in DB
 * @param {String} modelName - "Gallery", "User", "Post", etc.
 * @param {String} fieldName - The field to update in DB (default: 'url')
 */
const enqueueMedia = async (file, dbId, modelName, fieldName = "url") => {
  await mediaQueue.add("process-media", {
    fileId: dbId,
    filePath: file.path,
    mimeType: file.mimetype,
    outputDir: "uploads", // Ensure this matches your static folder
    modelName: modelName, // CRITICAL: This tells worker which Model to use
    fieldName: fieldName, // CRITICAL: Which field updates (e.g. 'url', 'avatar')
  });
};

module.exports = { enqueueMedia };
