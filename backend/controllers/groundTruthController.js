const GroundTruth = require('../models/GroundTruth');
const { normalizeValue } = require('../utils/normalization');

/**
 * Upload Ground Truth Dataset
 * POST /api/gt/upload
 */
exports.uploadGroundTruth = async (req, res) => {
  try {
    const groundTruthData = req.body;

    if (!Array.isArray(groundTruthData) || groundTruthData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Ground truth data must be a non-empty array'
      });
    }

    const validDocTypes = ['permit', 'garmushka', 'tazar', 'mavat'];
    const processedRecords = [];
    const documentTypesInUpload = new Set();

    for (const record of groundTruthData) {
      if (!record.file_name || !record.document_type || !record.field_name) {
        return res.status(400).json({
          success: false,
          message: 'Each record must have file_name, document_type, and field_name'
        });
      }

      if (!validDocTypes.includes(record.document_type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid document_type: ${record.document_type}. Must be one of: ${validDocTypes.join(', ')}`
        });
      }

      documentTypesInUpload.add(record.document_type.trim());

      processedRecords.push({
        file_name: record.file_name.trim(),
        document_type: record.document_type.trim(),
        field_name: record.field_name.trim(),
        expected_value: normalizeValue(record.expected_value)
      });
    }

    // Delete only the document types being uploaded
    for (const docType of documentTypesInUpload) {
      await GroundTruth.deleteMany({ document_type: docType });
    }

    const result = await GroundTruth.insertMany(processedRecords, { ordered: false });

    res.status(201).json({
      success: true,
      message: `Successfully uploaded ${result.length} ground truth records`,
      count: result.length
    });

  } catch (error) {
    console.error('Error uploading ground truth:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading ground truth data',
      error: error.message
    });
  }
};

/**
 * Get all Ground Truth records
 * GET /api/gt
 */
exports.getGroundTruth = async (req, res) => {
  try {
    const groundTruth = await GroundTruth.find().sort({ document_type: 1, file_name: 1 });

    res.status(200).json({
      success: true,
      count: groundTruth.length,
      data: groundTruth
    });

  } catch (error) {
    console.error('Error fetching ground truth:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ground truth data',
      error: error.message
    });
  }
};

/**
 * Get available document types (without exposing actual ground truth values)
 * GET /api/gt/available
 */
exports.getAvailableDocumentTypes = async (req, res) => {
  try {
    const documentTypes = await GroundTruth.distinct('document_type');

    res.status(200).json({
      success: true,
      available_document_types: documentTypes
    });

  } catch (error) {
    console.error('Error fetching available document types:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available document types',
      error: error.message
    });
  }
};

/**
 * Delete all Ground Truth records
 * DELETE /api/gt
 */
exports.deleteGroundTruth = async (req, res) => {
  try {
    const result = await GroundTruth.deleteMany({});

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} ground truth records`
    });

  } catch (error) {
    console.error('Error deleting ground truth:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting ground truth data',
      error: error.message
    });
  }
};
