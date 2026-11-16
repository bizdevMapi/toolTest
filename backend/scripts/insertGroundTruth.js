const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const GroundTruth = require('../models/GroundTruth');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in .env file');
    }
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ Connection Error:', error.message);
    process.exit(1);
  }
};

const insertGroundTruth = async (documentType) => {
  try {
    await connectDB();

    // Map document types to directories and file patterns
    const configMap = {
      garmushka: {
        dir: 'C:\\Users\\user01\\devel\\toolTest\\jsons\\ground-truth\\garmushka',
        pattern: /^G\d+\.json$/i,
        prefix: 'G'
      },
      permit: {
        dir: 'C:\\Users\\user01\\devel\\toolTest\\jsons\\ground-truth\\permit',
        pattern: /^P\d+\.json$/i,
        prefix: 'P'
      },
      tazar: {
        dir: 'C:\\Users\\user01\\devel\\toolTest\\jsons\\ground-truth\\tazar',
        pattern: /^T\d+\.json$/i,
        prefix: 'T'
      },
      mavat: {
        dir: 'C:\\Users\\user01\\devel\\toolTest\\jsons\\ground-truth\\mavat',
        pattern: /^M\d+\.json$/i,
        prefix: 'M'
      }
    };

    if (!configMap[documentType]) {
      console.error(`❌ Unknown document type: ${documentType}`);
      console.log('Available types: garmushka, permit, tazar, mavat');
      process.exit(1);
    }

    const config = configMap[documentType];
    const groundTruthDir = config.dir;

    // Check if directory exists
    if (!fs.existsSync(groundTruthDir)) {
      console.error(`❌ Directory not found: ${groundTruthDir}`);
      process.exit(1);
    }

    // Read all JSON files
    const files = fs.readdirSync(groundTruthDir)
      .filter(file => file.match(config.pattern))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
      });

    if (files.length === 0) {
      console.error(`❌ No ${config.prefix}*.json files found in ${documentType} directory`);
      process.exit(1);
    }

    console.log(`\n📁 Found ${files.length} files to process:`);
    console.log(files.join(', '));

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const file of files) {
      try {
        const filePath = path.join(groundTruthDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        console.log(`\n📄 Processing ${file}...`);

        const { file_name, document_type: fileDocType, fields } = data;

        if (!file_name || !fileDocType || !fields || !Array.isArray(fields)) {
          console.warn(`⚠️  Skipping ${file}: Invalid structure`);
          totalSkipped++;
          continue;
        }

        // Insert each field as a separate document
        for (const field of fields) {
          try {
            const { field_name, normalized_value } = field;

            if (!field_name) {
              console.warn(`  ⚠️  Skipping field: Missing field_name`);
              totalSkipped++;
              continue;
            }

            // Use "NULL" for null or missing values
            const value = normalized_value !== null && normalized_value !== undefined && normalized_value !== ''
              ? normalized_value
              : 'NULL';

            // Check if document already exists
            const existing = await GroundTruth.findOne({
              file_name,
              document_type: fileDocType,
              field_name
            });

            if (existing) {
              // Update existing document
              await GroundTruth.updateOne(
                { file_name, document_type: fileDocType, field_name },
                { expected_value: value }
              );
              console.log(`  ✏️  Updated: ${field_name} = ${value}`);
            } else {
              // Insert new document
              await GroundTruth.create({
                file_name,
                document_type: fileDocType,
                field_name,
                expected_value: value
              });
              console.log(`  ✅ Inserted: ${field_name} = ${value}`);
              totalInserted++;
            }
          } catch (error) {
            if (error.code === 11000) {
              // Duplicate key error - update instead
              await GroundTruth.updateOne(
                { file_name, document_type: fileDocType, field_name: field.field_name },
                { expected_value: field.normalized_value }
              );
              console.log(`  ✏️  Updated (duplicate): ${field.field_name}`);
            } else {
              console.error(`  ❌ Error inserting field ${field.field_name}:`, error.message);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
        totalSkipped++;
      }
    }

    console.log(`\n✅ Import Complete for ${documentType}!`);
    console.log(`   Total Inserted: ${totalInserted}`);
    console.log(`   Total Skipped: ${totalSkipped}`);

    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  }
};

// Get document type from command line argument or default to 'garmushka'
const documentType = process.argv[2] || 'garmushka';
insertGroundTruth(documentType);
