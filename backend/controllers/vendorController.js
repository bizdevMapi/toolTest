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
 * Calculate component score using quadratic formula
 * ציוני = W × ((Aᵢ - T) / (E - T))²
 *
 * @param {number} accuracy - Vendor accuracy (0-100)
 * @param {number} weight - Component weight (5, 20, etc)
 * @param {number} maxAccuracy - Maximum accuracy found across all vendors for this doc type
 * @param {number} threshold - Minimum threshold (default 80)
 * @returns {number} Calculated score
 */
function calculateComponentScore(accuracy, weight, maxAccuracy, threshold = 80) {
  // If accuracy is below threshold, return 0
  if (accuracy < threshold) {
    return 0;
  }

  // If max accuracy equals threshold, avoid division issues
  if (maxAccuracy === threshold) {
    return weight; // Full points if at threshold
  }

  // Apply quadratic formula: W × ((A - T) / (E - T))²
  const quadraticScore = Math.pow((accuracy - threshold) / (maxAccuracy - threshold), 2);
  return weight * quadraticScore;
}

/**
 * Calculate time score for a vendor
 *
 * Scoring rules:
 * - Only score time if accuracy >= 80%
 * - If accuracy < 80%, return 0 (no time score)
 * - Otherwise:
 *   - 5 points: time ≤ minTime + S, where S = MAX(minTime * 10%, 5 seconds)
 *   - 4 points: time ≤ 1.25*T + S
 *   - 3 points: time ≤ 1.5*T + S
 *   - 1 point: time > 1.5*T + S
 *
 * @param {number} vendorTime - Vendor's time in seconds
 * @param {number} minTime - Minimum time across all vendors for this doc type
 * @param {number} accuracy - Vendor's accuracy score (0-100)
 * @returns {number} Time score (1-5 points) or 0 if no time data or accuracy < 80%
 */
function calculateTimeScore(vendorTime, minTime, accuracy = 100) {
  // If accuracy is below 80%, no time score
  if (accuracy < 80) {
    return 0;
  }

  // If vendor time is 0 or missing, they didn't submit - no time score
  if (!vendorTime || vendorTime === 0 || !minTime || minTime === 0) {
    return 0;
  }

  const T = minTime;
  // S = MAX(10% of minTime, 5 seconds)
  const S = Math.max(T * 0.10, 5);

  // Check thresholds and return appropriate score
  if (vendorTime <= T + S) {
    return 5;  // Within tolerance
  }
  if (vendorTime <= 1.25 * T + S) {
    return 4;
  }
  if (vendorTime <= 1.5 * T + S) {
    return 3;
  }

  return 1;  // Over 1.5*T + S
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

        // Get time for this document type (all submissions for this vendor+docType have same time)
        const medianTime = vendorDocs.length > 0 ? vendorDocs[0].total_time_seconds : 0;
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
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 CALCULATING SCORES FOR VENDOR: ${vendor}`);
      console.log(`${'='.repeat(60)}`);

      const vendorSubs = submissions.filter(s => s.vendor_name === vendor);
      console.log(`Total submissions for this vendor: ${vendorSubs.length}`);

      const docTypeScores = [];
      let weightedAccuracyScore = 0;
      let totalTimeScore = 0;

      for (const docType of documentTypes) {
        console.log(`\n📄 Processing Document Type: ${docType.toUpperCase()}`);
        console.log('-'.repeat(60));

        const docSubs = vendorSubs.filter(s => s.document_type === docType);
        console.log(`  Submissions for ${docType}: ${docSubs.length}`);

        // Even if no submissions, we still need to add a score entry for this document type
        const docAccuracy = docSubs.length > 0
          ? docSubs.reduce((sum, s) => sum + s.accuracy_score, 0) / docSubs.length
          : 0;

        console.log(`  ✓ Raw Accuracy Score: ${docAccuracy} (${(docAccuracy * 100).toFixed(2)}%)`);

        // Get time for this document type (all submissions have same time per docType)
        const medianTime = docSubs.length > 0 ? docSubs[0].total_time_seconds : 0;
        console.log(`  ✓ Median Time: ${medianTime.toFixed(2)}s`);
        console.log(`  Submissions received: ${docSubs.length}`);

        const tMin = minMedianTimes[docType];
        console.log(`  Minimum median time (tMin): ${tMin ? tMin.toFixed(2) : 'N/A'}s`);

        const timeScore = tMin > 0 && medianTime > 0 ? 30 * Math.pow(tMin / medianTime, 3) : 0;
        console.log(`  ✓ Time Score: ${timeScore.toFixed(2)} (formula: 30 × (${tMin.toFixed(2)}/${medianTime.toFixed(2)})³)`);

        totalTimeScore += timeScore;

        // Calculate weighted accuracy
        const weight = accuracyWeights[docType] || 0;
        const weightedPoints = docAccuracy * weight;
        console.log(`  ✓ Weight for ${docType}: ${weight}`);
        console.log(`  ✓ Weighted Points: ${weightedPoints.toFixed(2)} (${docAccuracy.toFixed(2)} × ${weight})`);

        weightedAccuracyScore += weightedPoints;

        docTypeScores.push({
          document_type: docType,
          median_time: parseFloat(medianTime.toFixed(2)),
          time_score: parseFloat(timeScore.toFixed(2)),
          accuracy_score: parseFloat((docAccuracy * 100).toFixed(2)),
          weight_percentage: weight
        });

        // Always count all 4 document types
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📈 FINAL CALCULATION FOR ${vendor}`);
      console.log(`${'='.repeat(60)}`);

      const avgTimeScore = docTypeScores.length > 0 ? totalTimeScore / docTypeScores.length : 0;
      console.log(`Total Time Score (before average): ${totalTimeScore.toFixed(2)}`);
      console.log(`Average Time Score (÷ ${docTypeScores.length}): ${avgTimeScore.toFixed(2)}`);

      console.log(`Total Weighted Accuracy Score: ${weightedAccuracyScore.toFixed(2)}`);

      const automatedScore = weightedAccuracyScore + avgTimeScore;
      const subjectiveScore = 0; // Default, can be updated later
      const totalScore = automatedScore + subjectiveScore;

      console.log(`\n🎯 FINAL SCORES:`);
      console.log(`  Automated Score: ${automatedScore.toFixed(2)} (Accuracy: ${weightedAccuracyScore.toFixed(2)} + Time: ${avgTimeScore.toFixed(2)})`);
      console.log(`  Subjective Score: ${subjectiveScore}`);
      console.log(`  TOTAL SCORE: ${totalScore.toFixed(2)}`);
      console.log(`${'='.repeat(60)}\n`);

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
 * Get Intermediate Tables with Calculated Scores
 * GET /api/vendor/intermediate-tables
 *
 * Returns 4 tables (one per document type) with:
 * - vendor_name
 * - accuracy_score (accuracy for that document type %)
 * - weighted_score (calculated using quadratic formula)
 * - median_time (median time for that document type)
 *
 * Formula: W × ((A - T) / (E - T))²
 * W = weight, A = accuracy, T = threshold (80%), E = max accuracy
 */
exports.getIntermediateTables = async (req, res) => {
  try {
    const results = await EvaluationResult.find().sort({ vendor_name: 1 });

    console.log(`\n📋 getIntermediateTables called`);
    console.log(`Total evaluation results found: ${results.length}`);

    if (results.length === 0) {
      console.log(`⚠️ No evaluation results found in DB - returning empty data`);
      // Return empty intermediate tables instead of error
      // This is not an error state, just no data available yet
      return res.status(200).json({
        success: true,
        message: 'No evaluation results found yet',
        data: {
          permit: [],
          garmushka: [],
          tazar: [],
          mavat: []
        }
      });
    }

    const documentTypes = ['permit', 'garmushka', 'tazar', 'mavat'];
    const accuracyWeights = {
      permit: 5,
      garmushka: 5,
      tazar: 20,
      mavat: 20
    };

    const intermediateData = {};

    // Initialize tables for each document type
    for (const docType of documentTypes) {
      intermediateData[docType] = [];
    }

    // STEP 1: Collect all accuracy scores by document type
    const accuraciesByDocType = {};
    for (const docType of documentTypes) {
      accuraciesByDocType[docType] = [];
    }

    for (const result of results) {
      for (const docScore of result.document_type_scores) {
        const docType = docScore.document_type;
        accuraciesByDocType[docType].push(docScore.accuracy_score);
      }
    }

    // STEP 2: Find max accuracy and min time for each document type
    const maxAccuraciesByDocType = {};
    const minTimesByDocType = {};

    for (const docType of documentTypes) {
      if (accuraciesByDocType[docType].length > 0) {
        maxAccuraciesByDocType[docType] = Math.max(...accuraciesByDocType[docType]);
      } else {
        maxAccuraciesByDocType[docType] = 100; // Default if no data
      }

      // Find minimum time for this document type
      const times = [];
      for (const result of results) {
        const docScore = result.document_type_scores.find(s => s.document_type === docType);
        if (docScore && docScore.median_time > 0) {
          times.push(docScore.median_time);
        }
      }
      minTimesByDocType[docType] = times.length > 0 ? Math.min(...times) : 0;
    }

    console.log(`\n📊 Maximum accuracies by document type:`);
    for (const docType of documentTypes) {
      console.log(`   ${docType.toUpperCase()}: ${maxAccuraciesByDocType[docType].toFixed(2)}%`);
    }

    console.log(`\n⏱️ Minimum times by document type:`);
    for (const docType of documentTypes) {
      console.log(`   ${docType.toUpperCase()}: ${minTimesByDocType[docType].toFixed(2)}s`);
    }

    // STEP 3: Calculate weighted scores and time scores for each vendor and document type
    for (const result of results) {
      console.log(`\n📦 Processing vendor: ${result.vendor_name}`);

      for (const docScore of result.document_type_scores) {
        const docType = docScore.document_type;
        const accuracy = docScore.accuracy_score;
        const time = docScore.median_time;
        const weight = accuracyWeights[docType];
        const maxAccuracy = maxAccuraciesByDocType[docType];
        const minTime = minTimesByDocType[docType];

        // Calculate weighted accuracy score using quadratic formula
        const weightedScore = calculateComponentScore(accuracy, weight, maxAccuracy);

        // Calculate time score (only if accuracy >= 80%)
        const timeScore = calculateTimeScore(time, minTime, accuracy);

        // Add to intermediate table
        const tableRow = {
          vendor_name: result.vendor_name,
          accuracy_score: parseFloat(accuracy.toFixed(2)),
          weighted_score: parseFloat(weightedScore.toFixed(2)),
          median_time: time,
          min_time: minTime,
          time_score: parseFloat(timeScore.toFixed(2)),
          weight: weight,
          threshold: 80
        };

        console.log(`   ├─ ${docType.toUpperCase()}: accuracy=${accuracy.toFixed(2)}% (→${weightedScore.toFixed(2)}) | time=${time}s (→${timeScore.toFixed(2)})`);
        intermediateData[docType].push(tableRow);
      }
    }

    // Sort each table by weighted score descending, then by vendor name
    for (const docType of documentTypes) {
      intermediateData[docType].sort((a, b) => {
        if (b.weighted_score !== a.weighted_score) {
          return b.weighted_score - a.weighted_score;
        }
        return a.vendor_name.localeCompare(b.vendor_name);
      });
    }

    // Log the tables for debugging
    console.log('\n' + '='.repeat(100));
    console.log('📊 INTERMEDIATE TABLES WITH WEIGHTED SCORES - QUADRATIC FORMULA');
    console.log('='.repeat(100));

    for (const docType of documentTypes) {
      console.log(`\n📄 ${docType.toUpperCase()} (weight=${accuracyWeights[docType]}, threshold=80%, max=${maxAccuraciesByDocType[docType].toFixed(2)}%)`);
      console.log('-'.repeat(100));
      console.log(
        'Vendor Name'.padEnd(25) +
        'Accuracy (%)'.padEnd(15) +
        'Weighted Score'.padEnd(18) +
        'Formula'.padEnd(35) +
        'Time (s)'
      );
      console.log('-'.repeat(100));

      for (const row of intermediateData[docType]) {
        let formula = '';
        if (row.accuracy_score < 80) {
          formula = '< 80% → 0';
        } else {
          const maxAcc = maxAccuraciesByDocType[docType];
          formula = `${row.weight}×((${row.accuracy_score}-80)/(${maxAcc.toFixed(2)}-80))²`;
        }

        console.log(
          row.vendor_name.padEnd(25) +
          row.accuracy_score.toString().padEnd(15) +
          row.weighted_score.toString().padEnd(18) +
          formula.padEnd(35) +
          row.median_time.toString()
        );
      }

      if (intermediateData[docType].length === 0) {
        console.log('(אין נתונים)');
      }
    }
    console.log('='.repeat(100) + '\n');

    res.status(200).json({
      success: true,
      message: 'Intermediate tables with weighted scores generated successfully',
      data: intermediateData,
      maxAccuracies: maxAccuraciesByDocType
    });

  } catch (error) {
    console.error('Error generating intermediate tables:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating intermediate tables',
      error: error.message
    });
  }
};

/**
 * Get detailed submission history for a specific vendor
 * GET /api/vendor/:vendor_name/submission-history
 *
 * Returns all individual submissions grouped by document type
 */
exports.getVendorSubmissionHistory = async (req, res) => {
  try {
    const { vendor_name } = req.params;

    if (!vendor_name || !vendor_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vendor name is required'
      });
    }

    const submissions = await VendorSubmission.find({
      vendor_name: vendor_name.trim()
    }).sort({ document_type: 1, file_name: 1, field_name: 1 });

    if (submissions.length === 0) {
      return res.status(404).json({
        success: true,
        message: 'No submissions found for this vendor',
        data: []
      });
    }

    // Group submissions by document type
    const groupedByDocType = {};
    const documentTypes = ['permit', 'garmushka', 'tazar', 'mavat'];

    for (const docType of documentTypes) {
      groupedByDocType[docType] = {
        document_type: docType,
        submissions: [],
        stats: {
          total_fields: 0,
          correct_fields: 0,
          accuracy_percentage: 0,
          median_time: 0
        }
      };
    }

    // Group by document type
    for (const submission of submissions) {
      const docType = submission.document_type;
      if (groupedByDocType[docType]) {
        groupedByDocType[docType].submissions.push({
          file_name: submission.file_name,
          field_name: submission.field_name,
          extracted_value: submission.extracted_value,
          normalized_value: submission.normalized_value,
          ground_truth_value: submission.ground_truth_value || submission.extracted_value,
          accuracy_score: submission.accuracy_score,
          is_correct: submission.accuracy_score === 1,
          total_time_seconds: submission.total_time_seconds,
          uploaded_at: submission.createdAt
        });
      }
    }

    // Calculate stats for each document type
    for (const docType of documentTypes) {
      const data = groupedByDocType[docType];
      const subs = data.submissions;

      if (subs.length > 0) {
        data.stats.total_fields = subs.length;
        data.stats.correct_fields = subs.filter(s => s.is_correct).length;
        data.stats.accuracy_percentage = parseFloat(
          ((data.stats.correct_fields / subs.length) * 100).toFixed(2)
        );

        // Get median time
        const times = subs.map(s => s.total_time_seconds).filter(t => t > 0);
        if (times.length > 0) {
          times.sort((a, b) => a - b);
          data.stats.median_time = times[Math.floor(times.length / 2)];
        }
      }
    }

    res.status(200).json({
      success: true,
      vendor_name: vendor_name.trim(),
      data: groupedByDocType
    });

  } catch (error) {
    console.error('Error fetching vendor submission history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor submission history',
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

    // Recalculate rankings after score update - only for this vendor
    await recalculateRankings(vendor_name.trim());

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

    // Get time_seconds from request body
    const timeSeconds = req.body.time_seconds ? parseInt(req.body.time_seconds, 10) : null;
    if (timeSeconds !== null && (isNaN(timeSeconds) || timeSeconds < 0)) {
      return res.status(400).json({
        success: false,
        message: 'time_seconds must be a non-negative number (in seconds)'
      });
    }

    const vendorNameTrimmed = vendorName.trim();
    console.log('2222222', vendorNameTrimmed, 'document_type:', documentType, 'time_seconds:', timeSeconds)
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

            // Use time_seconds from request body if provided, otherwise use from file
            const fileTimeSeconds = submission.total_time_seconds || 2.5;
            const usedTimeSeconds = timeSeconds !== null ? timeSeconds : fileTimeSeconds;

            if (timeSeconds !== null) {
              console.log(`⏰ Using time_seconds from UI input: ${usedTimeSeconds}s (instead of file value: ${fileTimeSeconds}s)`);
            }

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

              // Use the normalized_value provided by the vendor
              // The vendor is responsible for normalization - this is part of the test!
              const vendorNormalizedValue = field.normalized_value

              // Apply the system's normalization function to both vendor's value and Ground Truth
              // This ensures consistent comparison (removes extra spaces, punctuation, etc.)
              const accuracyScore = calculateAccuracy(
                fieldName,
                expectedValue,
                vendorNormalizedValue
              );

              // Log the detailed comparison for this specific field
              console.log(`   FILE: ${submission.file_name} | FIELD: ${fieldName}`);
              console.log(`   ├─ Ground Truth:      "${expectedValue}"`);
              console.log(`   ├─ Vendor Normalized: "${vendorNormalizedValue}"`);
              console.log(`   ├─ Match: ${accuracyScore === 1.0 ? '✅ YES (1.0)' : '❌ NO (0.0)'}`);
              console.log(`   └─ Accuracy Score: ${(accuracyScore * 100).toFixed(2)}%\n`);

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

    // SAVE ALL SUBMISSIONS TO VendorSubmission collection
    const submissionsToSave = [];

    for (const file of jsonFiles) {
      try {
        const fileContent = file.getData().toString('utf8');
        const jsonData = JSON.parse(fileContent);
        const submissions = Array.isArray(jsonData) ? jsonData : [jsonData];

        for (const submission of submissions) {
          if (submission.fields && Array.isArray(submission.fields)) {
            if (submission.document_type !== documentType) continue;

            for (const field of submission.fields) {
              if (!field.field_name || field.extracted_value === undefined) continue;

              const fieldName = field.field_name.trim();
              const key = `${submission.file_name.trim()}|${submission.document_type.trim()}|${fieldName}`;
              const expectedValue = groundTruthMap[key];

              // Use the normalized_value provided by the vendor
              const vendorNormalizedValue = field.normalized_value || String(field.extracted_value);

              // Calculate accuracy
              const accuracyScore = calculateAccuracy(
                fieldName,
                expectedValue || '',
                vendorNormalizedValue
              );

              // Get time for this submission
              const fileTimeSeconds = submission.total_time_seconds || 0;
              const usedTimeSeconds = timeSeconds !== null ? timeSeconds : fileTimeSeconds;

              submissionsToSave.push({
                vendor_name: vendorNameTrimmed,
                file_name: submission.file_name.trim(),
                document_type: submission.document_type.trim(),
                field_name: fieldName,
                extracted_value: String(field.extracted_value),
                normalized_value: vendorNormalizedValue,
                accuracy_score: accuracyScore,
                total_time_seconds: usedTimeSeconds,
                ground_truth_value: expectedValue || '',
                upload_timestamp: new Date()
              });
            }
          }
        }
      } catch (parseError) {
        console.error(`Error parsing for DB save ${file.entryName}:`, parseError);
        continue;
      }
    }

    // Delete old submissions for this vendor and document type, then save new ones
    if (submissionsToSave.length > 0) {
      await VendorSubmission.deleteMany({
        vendor_name: vendorNameTrimmed,
        document_type: documentType
      });
      await VendorSubmission.insertMany(submissionsToSave);
      console.log(`✅ Saved ${submissionsToSave.length} submissions to VendorSubmission collection`);
    }

    // Calculate average per field, then average of averages
    const fieldAverages = {};
    let validFields = 0;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 DETAILED ACCURACY CALCULATION FOR ${documentType.toUpperCase()} (VENDOR: ${vendorNameTrimmed})`);
    console.log(`${'='.repeat(80)}`);
    console.log(`\n📋 Field-by-Field Breakdown:\n`);

    for (const [fieldName, scores] of Object.entries(fieldScores)) {
      if (scores.length > 0) {
        fieldAverages[fieldName] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        validFields++;

        const fieldPercentage = (fieldAverages[fieldName] * 100).toFixed(2);
        console.log(`   Field: ${fieldName.toUpperCase()}`);
        console.log(`   ├─ Individual scores per file: [${scores.map(s => (s * 100).toFixed(0) + '%').join(', ')}]`);
        console.log(`   ├─ Number of files: ${scores.length}`);
        console.log(`   ├─ Sum: ${scores.reduce((sum, s) => sum + s, 0).toFixed(4)}`);
        console.log(`   ├─ Average: ${(scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(4)}`);
        console.log(`   └─ Field Accuracy: ${fieldPercentage}%\n`);
      }
    }

    console.log(`${'='.repeat(80)}`);
    console.log(`🧮 OVERALL ACCURACY CALCULATION:\n`);

    const fieldAverageValues = Object.values(fieldAverages);
    console.log(`   Step 1: List all field averages`);
    console.log(`   ├─ Field averages: [${fieldAverageValues.map(v => (v * 100).toFixed(2) + '%').join(', ')}]`);
    console.log(`   ├─ Number of fields: ${validFields}\n`);

    console.log(`   Step 2: Sum all field averages`);
    const sumFieldAverages = fieldAverageValues.reduce((sum, avg) => sum + avg, 0);
    console.log(`   ├─ Sum: ${fieldAverageValues.map(v => v.toFixed(4)).join(' + ')} = ${sumFieldAverages.toFixed(4)}\n`);

    console.log(`   Step 3: Divide by number of fields`);
    // Overall accuracy = average of field averages (as percentage 0-100)
    const overallAccuracy = sumFieldAverages / validFields;
    console.log(`   ├─ Overall Accuracy = ${sumFieldAverages.toFixed(4)} ÷ ${validFields} = ${overallAccuracy.toFixed(4)}`);
    console.log(`   └─ As Percentage: ${(overallAccuracy * 100).toFixed(2)}%\n`);

    console.log(`${'='.repeat(80)}\n`);

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

    // Recalculate rankings - only for this vendor
    // Pass vendorNameTrimmed to update only this vendor
    await recalculateRankings(vendorNameTrimmed);

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
async function recalculateRankings(vendorNameToUpdate) {
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

    // Find minimum median time per document type across ALL vendors
    // (This is needed for fair comparison)
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

    // Recalculate time scores only for the vendor that was just updated
    // or for all if vendorNameToUpdate is not specified
    const vendorsToUpdate = vendorNameToUpdate
      ? results.filter(r => r.vendor_name === vendorNameToUpdate)
      : results;

    console.log(`\n📍 Recalculating scores for vendor: ${vendorNameToUpdate || 'ALL VENDORS'}`);
    console.log(`Total vendors in system: ${results.length}`);
    console.log(`Vendors being updated: ${vendorsToUpdate.length}\n`);

    // STEP 1: Calculate max accuracy for each document type across ALL vendors
    const maxAccuraciesByDocType = {};
    for (const docType of documentTypes) {
      let maxAccuracy = 0;
      for (const result of results) {
        const docScore = result.document_type_scores.find(s => s.document_type === docType);
        if (docScore && docScore.accuracy_score > maxAccuracy) {
          maxAccuracy = docScore.accuracy_score;
        }
      }
      maxAccuraciesByDocType[docType] = maxAccuracy > 0 ? maxAccuracy : 100;
    }

    console.log(`📊 Maximum accuracies by document type:`);
    for (const docType of documentTypes) {
      console.log(`   ${docType.toUpperCase()}: ${maxAccuraciesByDocType[docType].toFixed(2)}%`);
    }

    for (const result of vendorsToUpdate) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 RECALCULATING SCORES FOR VENDOR: ${result.vendor_name}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Document types received so far: ${result.document_type_scores.map(s => s.document_type).join(', ')}`);

      // Only calculate with document types that have been submitted
      // DO NOT add empty entries for missing types
      const submittedDocTypes = result.document_type_scores.map(s => s.document_type);
      const allSubmitted = documentTypes.every(dt => submittedDocTypes.includes(dt));

      if (!allSubmitted) {
        console.log(`⏳ PARTIAL SUBMISSION: Not all 4 document types received yet`);
        console.log(`   Missing: ${documentTypes.filter(dt => !submittedDocTypes.includes(dt)).join(', ')}`);
        console.log(`   → Skipping final calculation until all 4 types are submitted\n`);
        continue; // Skip this vendor for now
      }

      console.log(`✅ ALL 4 DOCUMENT TYPES RECEIVED - Calculating final scores\n`);

      let weightedAccuracyScore = 0;
      let totalTimeScore = 0;
      let documentTypesCount = 0;

      for (const docScore of result.document_type_scores) {
        console.log(`\n📄 Processing Document Type: ${docScore.document_type.toUpperCase()}`);
        console.log('-'.repeat(80));

        const docAccuracy = docScore.accuracy_score;
        const docType = docScore.document_type;
        const weight = accuracyWeights[docType] || 0;
        const maxAccuracy = maxAccuraciesByDocType[docType];
        const THRESHOLD = 80;

        console.log(`  ✓ Accuracy: ${docAccuracy.toFixed(2)}%`);
        console.log(`  ✓ Max Accuracy (across all vendors): ${maxAccuracy.toFixed(2)}%`);
        console.log(`  ✓ Median Time: ${docScore.median_time.toFixed(2)}s`);
        console.log(`  ✓ Weight: ${weight}`);
        console.log(`  ✓ Threshold: ${THRESHOLD}%`);

        let weightedPoints = 0;
        let timeScore = 0;

        if (docAccuracy < THRESHOLD) {
          console.log(`  ❌ BELOW THRESHOLD: ${docAccuracy.toFixed(2)}% < ${THRESHOLD}%`);
          console.log(`     → Weighted Points = 0 (no points below threshold)`);
          console.log(`     → Time Score = 0 (no time awarded below threshold)`);
          weightedPoints = 0;
          timeScore = 0;
        } else {
          console.log(`  ✅ ABOVE THRESHOLD: ${docAccuracy.toFixed(2)}% >= ${THRESHOLD}%`);

          // Calculate weighted score using the correct formula with max accuracy
          weightedPoints = calculateComponentScore(docAccuracy, weight, maxAccuracy, THRESHOLD);

          console.log(`     Formula: ${weight} × ((${docAccuracy.toFixed(2)} - ${THRESHOLD}) / (${maxAccuracy.toFixed(2)} - ${THRESHOLD}))²`);
          console.log(`     = ${weight} × (${(docAccuracy - THRESHOLD).toFixed(2)} / ${(maxAccuracy - THRESHOLD).toFixed(2)})²`);
          console.log(`     = ${weight} × ${Math.pow((docAccuracy - THRESHOLD) / (maxAccuracy - THRESHOLD), 2).toFixed(6)}`);
          console.log(`     → Weighted Points = ${weightedPoints.toFixed(2)}`);

          // Calculate time score (cubic formula) - only if above threshold
          const minTime = minMedianTimes[docType];
          if (minTime && minTime > 0 && docScore.median_time > 0) {
            timeScore = 30 * Math.pow(minTime / docScore.median_time, 3);
            console.log(`     Time Score: 30 × (${minTime.toFixed(2)}/${docScore.median_time.toFixed(2)})³ = ${timeScore.toFixed(2)}`);
          } else {
            console.log(`     Time Score: 0 (no min time available)`);
          }
        }

        docScore.time_score = parseFloat(timeScore.toFixed(2));
        totalTimeScore += timeScore;
        weightedAccuracyScore += weightedPoints;
        documentTypesCount++;
      }

      // Average time score across all document types
      const avgTimeScore = documentTypesCount > 0 ? totalTimeScore / documentTypesCount : 0;

      // Calculate automated score (accuracy + time)
      const automatedScore = weightedAccuracyScore + avgTimeScore;

      // Total score = automated + subjective (20 max) = 100 max
      const totalScore = automatedScore + (result.subjective_score || 0);

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📈 FINAL CALCULATION FOR ${result.vendor_name}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Total Weighted Accuracy Score: ${weightedAccuracyScore.toFixed(2)}`);
      console.log(`Total Time Score (before average): ${totalTimeScore.toFixed(2)}`);
      console.log(`Average Time Score (÷ ${documentTypesCount}): ${avgTimeScore.toFixed(2)}`);
      console.log(`\n🎯 FINAL SCORES:`);
      console.log(`  Accuracy Score: ${weightedAccuracyScore.toFixed(2)}`);
      console.log(`  Time Score: ${avgTimeScore.toFixed(2)}`);
      console.log(`  Automated Score: ${automatedScore.toFixed(2)}`);
      console.log(`  Subjective Score: ${result.subjective_score || 0}`);
      console.log(`  ════════════════════════`);
      console.log(`  TOTAL SCORE: ${totalScore.toFixed(2)}`);
      console.log(`${'='.repeat(80)}\n`);

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
