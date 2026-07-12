const VendorSubmission = require('../models/VendorSubmission');
const GroundTruth = require('../models/GroundTruth');
const EvaluationResult = require('../models/EvaluationResult');
const { normalizeValue, calculateAccuracy, calculateMedian, getCanonicalFieldNames } = require('../utils/normalization');
const AdmZip = require('adm-zip');

/**
 * Convert time string (HH:MM:SS) to total seconds
 */
function timeToSeconds(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length !== 3) return null;
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseInt(parts[2]);
  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Upload Vendor Submission
 * POST /api/vendor/upload
 */
exports.uploadVendorSubmission = async (req, res) => {
  try {
    const { vendor_name, submissions } = req.body;

    if (!vendor_name || !vendor_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vendor name is required'
      });
    }

    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Submissions must be a non-empty array'
      });
    }

    const vendorNameTrimmed = vendor_name.trim();

    const documentTypes = [...new Set(submissions.map(s => s.document_type))];
    const expectedDocTypes = ['permit', 'garmushka', 'tazar', 'mavat'];

    if (documentTypes.length !== 4 || !expectedDocTypes.every(dt => documentTypes.includes(dt))) {
      return res.status(400).json({
        success: false,
        message: 'Submissions must include exactly 4 document types: permit, garmushka, tazar, mavat'
      });
    }

    const groundTruthMap = {};
    const groundTruthRecords = await GroundTruth.find();

    for (const gt of groundTruthRecords) {
      const key = `${gt.file_name}|${gt.document_type}|${gt.field_name}`;
      groundTruthMap[key] = gt.expected_value;
    }

    const processedSubmissions = [];

    for (const submission of submissions) {
      if (!submission.file_name || !submission.document_type || !submission.field_name) {
        return res.status(400).json({
          success: false,
          message: 'Each submission must have file_name, document_type, field_name, extracted_value, and total_time_seconds'
        });
      }

      if (submission.total_time_seconds === undefined || submission.total_time_seconds < 0) {
        return res.status(400).json({
          success: false,
          message: 'total_time_seconds must be a non-negative number'
        });
      }

      const key = `${submission.file_name.trim()}|${submission.document_type.trim()}|${submission.field_name.trim()}`;
      const expectedValue = groundTruthMap[key];

      if (!expectedValue) {
        return res.status(400).json({
          success: false,
          message: `No ground truth found for: ${key}`
        });
      }

      const extractedValue = submission.extracted_value;
      const normalizedValue = normalizeValue(extractedValue);

      const accuracyScore = calculateAccuracy(
        submission.field_name.trim(),
        expectedValue,
        normalizedValue
      );

      processedSubmissions.push({
        vendor_name: vendorNameTrimmed,
        file_name: submission.file_name.trim(),
        document_type: submission.document_type.trim(),
        field_name: submission.field_name.trim(),
        extracted_value: String(extractedValue),
        normalized_value: normalizedValue,
        accuracy_score: accuracyScore,
        total_time_seconds: submission.total_time_seconds
      });
    }

    await VendorSubmission.deleteMany({ vendor_name: vendorNameTrimmed });

    const result = await VendorSubmission.insertMany(processedSubmissions);

    res.status(201).json({
      success: true,
      message: `Successfully uploaded ${result.length} submissions for vendor: ${vendorNameTrimmed}`,
      vendor_name: vendorNameTrimmed,
      count: result.length
    });

  } catch (error) {
    console.error('Error uploading vendor submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading vendor submission',
      error: error.message
    });
  }
};

/**
 * Get all vendor submissions
 * GET /api/vendor/submissions
 */
exports.getVendorSubmissions = async (req, res) => {
  try {
    const submissions = await VendorSubmission.find().sort({ vendor_name: 1, document_type: 1 });

    const vendors = [...new Set(submissions.map(s => s.vendor_name))];

    res.status(200).json({
      success: true,
      count: submissions.length,
      vendors: vendors,
      data: submissions
    });

  } catch (error) {
    console.error('Error fetching vendor submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor submissions',
      error: error.message
    });
  }
};

/**
 * Calculate Final Scores for All Vendors
 * POST /api/vendor/calculate-final
 *
 * Weight structure (total 100%):
 * - permit accuracy: 5%
 * - garmushka accuracy: 5%
 * - tazar accuracy: 20%
 * - mavat accuracy: 20%
 * - time score: 30%
 * - subjective score: 20%
 */
exports.calculateFinalScores = async (req, res) => {
  try {
    const submissions = await VendorSubmission.find();

    if (submissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No vendor submissions found. Please upload vendor data first.'
      });
    }

    const vendorNames = [...new Set(submissions.map(s => s.vendor_name))];
    const documentTypes = ['permit', 'garmushka', 'tazar', 'mavat'];

    // Define weights for each document type accuracy (out of 100)
    const accuracyWeights = {
      permit: 5,
      garmushka: 5,
      tazar: 20,
      mavat: 20
    };

    const minMedianTimes = {};

    for (const docType of documentTypes) {
      const vendorMedians = [];

      for (const vendor of vendorNames) {
        const vendorDocs = submissions.filter(
          s => s.vendor_name === vendor && s.document_type === docType
        );

        const uniqueFiles = [...new Set(vendorDocs.map(s => s.file_name))];
        const fileTimes = uniqueFiles.map(fileName => {
          const fileSubmissions = vendorDocs.filter(s => s.file_name === fileName);
          return fileSubmissions.length > 0 ? fileSubmissions[0].total_time_seconds : 0;
        });

        const medianTime = calculateMedian(fileTimes);
        if (medianTime > 0) {
          vendorMedians.push(medianTime);
        }
      }

      if (vendorMedians.length > 0) {
        minMedianTimes[docType] = Math.min(...vendorMedians);
      }
    }

    const evaluationResults = [];

    for (const vendor of vendorNames) {
      const vendorSubs = submissions.filter(s => s.vendor_name === vendor);

      const docTypeScores = [];
      let weightedAccuracyScore = 0;
      let totalTimeScore = 0;

      for (const docType of documentTypes) {
        const docSubs = vendorSubs.filter(s => s.document_type === docType);

        if (docSubs.length === 0) continue;

        const docAccuracy = docSubs.reduce((sum, s) => sum + s.accuracy_score, 0) / docSubs.length;

        const uniqueFiles = [...new Set(docSubs.map(s => s.file_name))];
        const fileTimes = uniqueFiles.map(fileName => {
          const fileSubmissions = docSubs.filter(s => s.file_name === fileName);
          return fileSubmissions.length > 0 ? fileSubmissions[0].total_time_seconds : 0;
        });

        const medianTime = calculateMedian(fileTimes);

        const tMin = minMedianTimes[docType];
        const timeScore = tMin > 0 && medianTime > 0 ? 30 * Math.pow(tMin / medianTime, 3) : 0;

        totalTimeScore += timeScore;

        // Calculate weighted accuracy
        const weight = accuracyWeights[docType] || 0;
        const weightedPoints = docAccuracy * weight;
        weightedAccuracyScore += weightedPoints;

        docTypeScores.push({
          document_type: docType,
          median_time: parseFloat(medianTime.toFixed(2)),
          time_score: parseFloat(timeScore.toFixed(2)),
          accuracy_score: parseFloat((docAccuracy * 100).toFixed(2)),
          weight_percentage: weight
        });
      }

      const avgTimeScore = docTypeScores.length > 0 ? totalTimeScore / docTypeScores.length : 0;

      const automatedScore = weightedAccuracyScore + avgTimeScore;
      const subjectiveScore = 0; // Default, can be updated later
      const totalScore = automatedScore + subjectiveScore;

      evaluationResults.push({
        vendor_name: vendor,
        document_type_scores: docTypeScores,
        overall_accuracy: parseFloat(weightedAccuracyScore.toFixed(2)),
        overall_time_score: parseFloat(avgTimeScore.toFixed(2)),
        automated_score: parseFloat(automatedScore.toFixed(2)),
        subjective_score: subjectiveScore,
        total_score: parseFloat(totalScore.toFixed(2))
      });
    }

    evaluationResults.sort((a, b) => b.total_score - a.total_score);

    evaluationResults.forEach((result, index) => {
      result.rank = index + 1;
    });

    await EvaluationResult.deleteMany({});
    await EvaluationResult.insertMany(evaluationResults);

    res.status(200).json({
      success: true,
      message: 'Final scores calculated successfully',
      data: evaluationResults
    });

  } catch (error) {
    console.error('Error calculating final scores:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating final scores',
      error: error.message
    });
  }
};

/**
 * Get Evaluation Results
 * GET /api/vendor/results
 */
exports.getEvaluationResults = async (req, res) => {
  try {
    const results = await EvaluationResult.find().sort({ rank: 1 });

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });

  } catch (error) {
    console.error('Error fetching evaluation results:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching evaluation results',
      error: error.message
    });
  }
};

/**
 * Delete all vendor submissions and results
 * DELETE /api/vendor/all
 */
exports.deleteAllVendorData = async (req, res) => {
  try {
    const submissionsDeleted = await VendorSubmission.deleteMany({});
    const resultsDeleted = await EvaluationResult.deleteMany({});

    res.status(200).json({
      success: true,
      message: `Deleted ${submissionsDeleted.deletedCount} submissions and ${resultsDeleted.deletedCount} results`
    });

  } catch (error) {
    console.error('Error deleting vendor data:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting vendor data',
      error: error.message
    });
  }
};

/**
 * Update subjective score for a vendor
 * PUT /api/vendor/subjective-score
 * Body: { vendor_name: string, subjective_score: number (0-20) }
 */
exports.updateSubjectiveScore = async (req, res) => {
  try {
    const { vendor_name, subjective_score } = req.body;

    if (!vendor_name || !vendor_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vendor name is required'
      });
    }

    if (subjective_score === undefined || subjective_score < 0 || subjective_score > 20) {
      return res.status(400).json({
        success: false,
        message: 'Subjective score must be between 0 and 20'
      });
    }

    const result = await EvaluationResult.findOne({ vendor_name: vendor_name.trim() });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Vendor not found: ${vendor_name}`
      });
    }

    result.subjective_score = subjective_score;
    result.total_score = result.automated_score + subjective_score;

    await result.save();

    // Recalculate rankings after score update
    await recalculateRankings();

    // Get updated result with new rank
    const updatedResult = await EvaluationResult.findOne({ vendor_name: vendor_name.trim() });

    res.status(200).json({
      success: true,
      message: `Subjective score updated for vendor: ${vendor_name}`,
      data: updatedResult
    });

  } catch (error) {
    console.error('Error updating subjective score:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating subjective score',
      error: error.message
    });
  }
};

/**
 * Upload Vendor Submission from ZIP file (permit only)
 * Calculate scores and save only the final result
 * POST /api/vendor/upload-zip
 */
exports.uploadVendorZip = async (req, res) => {
  console.log('1111111')
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No ZIP file uploaded'
      });
    }

    const vendorName = req.body.vendor_name;
    if (!vendorName || !vendorName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vendor name is required'
      });
    }

    const documentType = req.body.document_type || 'permit';
    const validDocTypes = ['permit', 'garmushka', 'tazar', 'mavat'];

    if (!validDocTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid document_type: ${documentType}. Must be one of: ${validDocTypes.join(', ')}`
      });
    }

    const vendorNameTrimmed = vendorName.trim();
    console.log('2222222', vendorNameTrimmed, 'document_type:', documentType)
    const zip = new AdmZip(req.file.buffer);
    const zipEntries = zip.getEntries();

    const jsonFiles = zipEntries.filter(entry =>
      !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.json')
    );

    if (jsonFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No JSON files found in ZIP'
      });
    }

    const groundTruthMap = {};
    const groundTruthRecords = await GroundTruth.find({ document_type: documentType });
    console.log('3333333', groundTruthRecords)

    // Check if ground truth exists for this document type
    if (groundTruthRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No ground truth data found for document type: ${documentType}. Please upload ground truth data first.`
      });
    }

    // Collect all unique file names from Ground Truth
    const expectedFiles = new Set();

    for (const gt of groundTruthRecords) {
      const key = `${gt.file_name}|${gt.document_type}|${gt.field_name}`;
      groundTruthMap[key] = gt.expected_value;
      expectedFiles.add(gt.file_name);
    }

    // Get canonical field names for this document type
    const expectedFields = getCanonicalFieldNames(documentType);

    // Store scores per field and times for calculation (not saving to DB)
    const fieldScores = {};
    for (const field of expectedFields) {
      fieldScores[field.toLowerCase()] = [];
    }

    const fileTimes = {};
    const submittedFiles = new Set();

    for (const file of jsonFiles) {
      try {
        const fileContent = file.getData().toString('utf8');
        const jsonData = JSON.parse(fileContent);

        const submissions = Array.isArray(jsonData) ? jsonData : [jsonData];

        for (const submission of submissions) {
          // Check if this is the new format with "fields" array
          if (submission.fields && Array.isArray(submission.fields)) {
            // New format: { file_name, document_type, total_time_seconds, fields: [...] }
            if (!submission.file_name || !submission.document_type) {
              continue;
            }

            if (submission.document_type !== documentType) {
              continue;
            }

            // Validate time calculation
            let hasTimeCalculationError = false;
            if (submission.start_time && submission.end_time && submission.total_time_seconds !== null) {
              const startSeconds = timeToSeconds(submission.start_time);
              const endSeconds = timeToSeconds(submission.end_time);
              const calculatedDiff = endSeconds - startSeconds;

              if (calculatedDiff !== submission.total_time_seconds) {
                console.log(`⏱️ Time calculation error in file ${submission.file_name}: start_time=${submission.start_time}, end_time=${submission.end_time}, reported total_time_seconds=${submission.total_time_seconds}, but should be ${calculatedDiff} seconds`);
                hasTimeCalculationError = true;
              }
            }

            const timeSeconds = submission.total_time_seconds || 2.5;

            // If time calculation is wrong, give score 0 for ALL fields in this file
            if (hasTimeCalculationError) {
              console.log(`❌ Giving score 0 to all fields in file ${submission.file_name} due to time calculation error`);

              const expectedFields = getCanonicalFieldNames(submission.document_type);
              for (const fieldName of expectedFields) {
                const canonicalFieldName = fieldName.toLowerCase();
                if (fieldScores[canonicalFieldName]) {
                  fieldScores[canonicalFieldName].push(0);
                }
              }

              continue; // Skip to next file
            }

            // Process each field
            for (const field of submission.fields) {
              if (!field.field_name || field.extracted_value === undefined) {
                console.log(`⚠️ Skipping incomplete field:`, field);
                continue;
              }

              // STRICT MODE: Field name must match exactly (no normalization)
              const fieldName = field.field_name.trim();
              const key = `${submission.file_name.trim()}|${submission.document_type.trim()}|${fieldName}`;
              const expectedValue = groundTruthMap[key];

              // If field name doesn't match Ground Truth, score = 0
              if (!expectedValue) {
                console.log(`❌ Field name mismatch or missing ground truth: ${key}`);
                console.log(`📋 Expected fields for ${submission.document_type}:`,
                  getCanonicalFieldNames(submission.document_type));
                console.log(`📋 Available ground truth keys for this file:`,
                  Object.keys(groundTruthMap).filter(k => k.startsWith(submission.file_name.trim())));

                // Score = 0 for incorrect field name
                const canonicalFieldName = fieldName.toLowerCase();
                if (fieldScores[canonicalFieldName] !== undefined) {
                  fieldScores[canonicalFieldName].push(0);
                } else {
                  // Try to find which canonical field this might be
                  const expectedFields = getCanonicalFieldNames(submission.document_type);
                  for (const expectedField of expectedFields) {
                    if (expectedField.toLowerCase() === canonicalFieldName) {
                      fieldScores[expectedField.toLowerCase()].push(0);
                      break;
                    }
                  }
                }
                continue; // Skip to next field
              }

              // Use the normalized_value provided by the vendor (or extracted_value as fallback)
              // The vendor is responsible for normalization - this is part of the test!
              const vendorNormalizedValue = field.normalized_value || field.extracted_value;

              // Apply the system's normalization function to both vendor's value and Ground Truth
              // This ensures consistent comparison (removes extra spaces, punctuation, etc.)
              const accuracyScore = calculateAccuracy(
                fieldName,
                expectedValue,
                vendorNormalizedValue
              );

              // Collect scores per field (not saving to DB)
              const canonicalFieldName = fieldName.toLowerCase();
              if (fieldScores[canonicalFieldName]) {
                fieldScores[canonicalFieldName].push(accuracyScore);
              }

              // Track time per file (use first occurrence)
              const fileName = submission.file_name.trim();
              if (!fileTimes[fileName]) {
                fileTimes[fileName] = timeSeconds;
              }

              // Track which files were submitted
              submittedFiles.add(fileName);
            }
          }
        }
      } catch (parseError) {
        console.error(`Error parsing ${file.entryName}:`, parseError);
        continue;
      }
    }

    // Add zero scores for missing files
    const missingFiles = [...expectedFiles].filter(file => !submittedFiles.has(file));

    if (missingFiles.length > 0) {
      console.log(`Missing files for vendor ${vendorNameTrimmed}:`, missingFiles);

      // For each missing file, add 0 score for all fields
      for (const missingFile of missingFiles) {
        for (const fieldName of expectedFields) {
          if (fieldScores[fieldName]) {
            fieldScores[fieldName].push(0);
          }
        }

        // Note: We do NOT add time for missing files - median is calculated only from submitted files
      }
    }

    // Check if we have any scores
    const totalFields = Object.values(fieldScores).reduce((sum, scores) => sum + scores.length, 0);
    if (totalFields === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid permit submissions found in ZIP files'
      });
    }

    // Calculate average per field, then average of averages
    const fieldAverages = {};
    let validFields = 0;

    for (const [fieldName, scores] of Object.entries(fieldScores)) {
      if (scores.length > 0) {
        fieldAverages[fieldName] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        validFields++;
      }
    }

    // Overall accuracy = average of field averages (as percentage 0-100)
    const overallAccuracy = Object.values(fieldAverages).reduce((sum, avg) => sum + avg, 0) / validFields;

    // Calculate median time
    const times = Object.values(fileTimes);
    const medianTime = calculateMedian(times);

    // Calculate time score (will be recalculated in final scoring with proper weights)
    const timeScore = 30; // Placeholder, will be recalculated

    // Find existing result or create new one
    let existingResult = await EvaluationResult.findOne({ vendor_name: vendorNameTrimmed });

    const newDocTypeScore = {
      document_type: documentType,
      median_time: parseFloat(medianTime.toFixed(2)),
      time_score: parseFloat(timeScore.toFixed(2)),
      accuracy_score: parseFloat((overallAccuracy * 100).toFixed(2))
    };

    if (existingResult) {
      // Update or add this document type score
      const existingIndex = existingResult.document_type_scores.findIndex(
        s => s.document_type === documentType
      );

      if (existingIndex >= 0) {
        existingResult.document_type_scores[existingIndex] = newDocTypeScore;
      } else {
        existingResult.document_type_scores.push(newDocTypeScore);
      }

      // Recalculate overall scores - will be done in recalculateRankings()
      // Just save the document for now
      await existingResult.save();
    } else {
      // Create new result with placeholder scores
      // Real scores will be calculated in recalculateRankings()
      const evaluationResult = {
        vendor_name: vendorNameTrimmed,
        document_type_scores: [newDocTypeScore],
        overall_accuracy: 0,
        overall_time_score: 0,
        automated_score: 0,
        subjective_score: 0,
        total_score: 0,
        rank: 0
      };

      await EvaluationResult.create(evaluationResult);
    }

    // Recalculate rankings for all vendors
    await recalculateRankings();

    // Get updated result
    const finalResult = await EvaluationResult.findOne({ vendor_name: vendorNameTrimmed });

    res.status(201).json({
      success: true,
      message: `Successfully evaluated vendor: ${vendorNameTrimmed} for ${documentType}`,
      vendor_name: vendorNameTrimmed,
      document_type: documentType,
      accuracy: Math.round(overallAccuracy * 100),
      field_averages: fieldAverages,
      median_time: medianTime.toFixed(2),
      files_processed: jsonFiles.length,
      total_fields_evaluated: totalFields,
      expected_files: expectedFiles.size,
      submitted_files: submittedFiles.size,
      missing_files: missingFiles.length > 0 ? missingFiles : undefined,
      overall_result: {
        total_score: finalResult.total_score,
        overall_accuracy: finalResult.overall_accuracy,
        overall_time_score: finalResult.overall_time_score,
        document_types_evaluated: finalResult.document_type_scores.map(s => s.document_type)
      }
    });

  } catch (error) {
    console.error('Error uploading vendor ZIP:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading vendor ZIP',
      error: error.message
    });
  }
};

/**
 * Recalculate rankings and time scores for all vendors
 * Internal function called after each vendor upload
 *
 * Weight structure (total 100%):
 * - permit accuracy: 5%
 * - garmushka accuracy: 5%
 * - tazar accuracy: 20%
 * - mavat accuracy: 20%
 * - time score: 30%
 * - subjective score: 20%
 */
async function recalculateRankings() {
  try {
    const results = await EvaluationResult.find();

    if (results.length === 0) return;

    const documentTypes = ['permit', 'garmushka', 'tazar', 'mavat'];

    // Define weights for each document type accuracy (out of 100)
    const accuracyWeights = {
      permit: 5,
      garmushka: 5,
      tazar: 20,
      mavat: 20
    };

    // Find minimum median time per document type across all vendors
    const minMedianTimes = {};

    for (const docType of documentTypes) {
      let minTime = Infinity;
      for (const result of results) {
        const docScore = result.document_type_scores.find(s => s.document_type === docType);
        if (docScore && docScore.median_time > 0 && docScore.median_time < minTime) {
          minTime = docScore.median_time;
        }
      }
      if (minTime < Infinity) {
        minMedianTimes[docType] = minTime;
      }
    }

    // Recalculate time scores for each document type
    for (const result of results) {
      let weightedAccuracyScore = 0;
      let totalTimeScore = 0;
      let documentTypesCount = 0;

      for (const docScore of result.document_type_scores) {
        const minTime = minMedianTimes[docScore.document_type];

        // Calculate time score for this document type
        if (minTime && minTime > 0 && docScore.median_time > 0) {
          const timeScore = 30 * Math.pow(minTime / docScore.median_time, 3);
          docScore.time_score = parseFloat(timeScore.toFixed(2));
          totalTimeScore += docScore.time_score;
        } else {
          docScore.time_score = 0;
        }

        // Calculate weighted accuracy for this document type
        const weight = accuracyWeights[docScore.document_type] || 0;
        // docScore.accuracy_score is already a percentage (0-100)
        // We need to convert it to weighted points
        const weightedPoints = (docScore.accuracy_score / 100) * weight;
        weightedAccuracyScore += weightedPoints;

        documentTypesCount++;
      }

      // Average time score across all document types, then scale to 30 points
      const avgTimeScore = documentTypesCount > 0 ? totalTimeScore / documentTypesCount : 0;

      // Calculate automated score (accuracy + time) out of 80 points
      const automatedScore = weightedAccuracyScore + avgTimeScore;

      // Total score = automated (80 max) + subjective (20 max) = 100 max
      const totalScore = automatedScore + (result.subjective_score || 0);

      result.overall_accuracy = parseFloat(weightedAccuracyScore.toFixed(2));
      result.overall_time_score = parseFloat(avgTimeScore.toFixed(2));
      result.automated_score = parseFloat(automatedScore.toFixed(2));
      result.total_score = parseFloat(totalScore.toFixed(2));
    }

    // Sort by total score and assign ranks
    results.sort((a, b) => b.total_score - a.total_score);
    for (let i = 0; i < results.length; i++) {
      results[i].rank = i + 1;
      await results[i].save();
    }
  } catch (error) {
    console.error('Error recalculating rankings:', error);
  }
}
