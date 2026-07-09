const fs = require('fs');
const path = require('path');

const inputDir = './temp_garmushka/JSON';
const outputFile = './ground-truth-garmushka.json';

const allRecords = [];

// Read all JSON files
const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json')).sort();

console.log(`Found ${files.length} garmushka files`);

for (const file of files) {
  const filePath = path.join(inputDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  console.log(`Processing ${data.file_name}...`);

  // Convert format
  for (const field of data.fields) {
    allRecords.push({
      file_name: data.file_name,
      document_type: data.document_type,
      field_name: field.field_name,
      expected_value: field.normalized_GT
    });
  }
}

// Write merged file
fs.writeFileSync(outputFile, JSON.stringify(allRecords, null, 2));

console.log(`\n✅ Created ${outputFile} with ${allRecords.length} records`);
console.log(`Files processed: ${files.join(', ')}`);
