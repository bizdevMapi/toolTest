/**
 * Normalize field values according to the specification:
 * - Strip leading/trailing whitespace
 * - Convert slashes (/) and dashes (-) to underscores (_)
 * - Treat missing or "NULL" as the string 'NULL'
 */
function normalizeValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'NULL';
  }

  let normalized = String(value).trim();

  if (normalized === '' || normalized.toUpperCase() === 'NULL') {
    return 'NULL';
  }

  normalized = normalized.replace(/[\/\-]/g, '_');

  return normalized;
}

/**
 * Calculate Jaccard Similarity for multi-value fields
 * Parses comma-separated values into sets and computes |Intersection| / |Union|
 */
function calculateJaccardSimilarity(expected, extracted) {
  if (expected === 'NULL' && extracted === 'NULL') {
    return 1.0;
  }

  if (expected === 'NULL' || extracted === 'NULL') {
    return 0.0;
  }

  const expectedSet = new Set(
    expected.split(',').map(item => item.trim()).filter(item => item !== '')
  );

  const extractedSet = new Set(
    extracted.split(',').map(item => item.trim()).filter(item => item !== '')
  );

  if (expectedSet.size === 0 && extractedSet.size === 0) {
    return 1.0;
  }

  const intersection = new Set(
    [...expectedSet].filter(item => extractedSet.has(item))
  );

  const union = new Set([...expectedSet, ...extractedSet]);

  return union.size === 0 ? 0.0 : intersection.size / union.size;
}

/**
 * Calculate accuracy score based on field type
 * Single-value fields: strict match (1 or 0)
 * Multi-value fields (gush, parcel): Jaccard similarity
 */
function calculateAccuracy(fieldName, expectedValue, extractedValue) {
  const normalizedExpected = normalizeValue(expectedValue);
  const normalizedExtracted = normalizeValue(extractedValue);

  const multiValueFields = ['gush', 'parcel'];

  if (multiValueFields.includes(fieldName.toLowerCase())) {
    return calculateJaccardSimilarity(normalizedExpected, normalizedExtracted);
  }

  return normalizedExpected === normalizedExtracted ? 1.0 : 0.0;
}

/**
 * Calculate median from an array of numbers
 */
function calculateMedian(numbers) {
  if (!numbers || numbers.length === 0) {
    return 0;
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Normalize field names to match Ground Truth schema
 * Accepts common variations and maps them to the correct field name
 *
 * @param {string} fieldName - The field name from vendor submission
 * @param {string} documentType - The document type (permit, garmushka, tazar, mavat)
 * @returns {string} - The normalized field name
 */
function normalizeFieldName(fieldName, documentType) {
  const normalized = fieldName.toLowerCase().trim();

  // Field name mappings for common variations
  const fieldMappings = {
    // Settlement variations
    'settlement': 'setl',
    'yishuv': 'setl',
    'city': 'setl',
    'town': 'setl',

    // Gush variations
    'gush_number': 'gush',
    'gush_num': 'gush',
    'block': 'gush',
    'block_number': 'gush',

    // Parcel variations
    'parcel_num': 'parcel',
    'parcel_number': 'parcel',
    'helka': 'parcel',
    'plot': 'parcel',
    'lot': 'parcel',

    // Building number variations - context dependent
    'building_num': documentType === 'garmushka' ? 'building_num' : 'bld_num',
    'building_number': documentType === 'garmushka' ? 'building_num' : 'bld_num',
    'num_bld': documentType === 'garmushka' ? 'building_num' : 'bld_num',
    'bldg_num': documentType === 'garmushka' ? 'building_num' : 'bld_num',
    'bld_num': documentType === 'garmushka' ? 'building_num' : 'bld_num',

    // Primary use variations
    'primary_use': 'primary_use',
    'use_primary': 'primary_use',
    'usage': 'primary_use',
    'sug_shimush': 'primary_use',

    // Plan ID variations
    'plan_id': 'plan_id',
    'id_plan': 'plan_id',
    'plan_num': 'plan_id',
    'plan_number': 'plan_id',
    'tokhnit': 'plan_id',

    // Lot size variations
    'lot_size': 'lot_size',
    'size_lot': 'lot_size',
    'plot_size': 'lot_size',
    'godel_magrash': 'lot_size',
  };

  // Return mapped name or original if no mapping found
  return fieldMappings[normalized] || fieldName;
}

/**
 * Get the canonical field names for a document type
 * These are the field names used in Ground Truth database
 *
 * @param {string} documentType - The document type
 * @returns {Array<string>} - Array of canonical field names
 */
function getCanonicalFieldNames(documentType) {
  const fieldNamesMap = {
    permit: ['setl', 'gush', 'parcel', 'bld_num'],
    garmushka: ['gush', 'parcel', 'building_num', 'primary_use'],
    tazar: ['setl', 'gush', 'parcel', 'plan_id'],
    mavat: ['plan_id', 'setl', 'primary_use', 'lot_size']
  };

  return fieldNamesMap[documentType] || [];
}

module.exports = {
  normalizeValue,
  calculateJaccardSimilarity,
  calculateAccuracy,
  calculateMedian,
  normalizeFieldName,
  getCanonicalFieldNames
};
