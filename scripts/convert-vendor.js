const fs = require('fs');
const path = require('path');

const inputDir = 'C:\\Users\\user01.HP61-LAP\\Downloads\\JSONS\\vendor-extracted\\p';
const outputFile = './vendor-submission-all.json';

const allRecords = [];

// Read all JSON files
const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json')).sort();

console.log(`Found ${files.length} files`);

for (const file of files) {
  const filePath = path.join(inputDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  console.log(`Processing ${data.file_name}...`);

  // Get total_time_seconds (use a default if null)
  const timeSeconds = data.total_time_seconds || 2.5;

  // Convert format
  for (const field of data.fields) {
    allRecords.push({
      file_name: data.file_name,
      document_type: data.document_type,
      field_name: field.field_name,
      extracted_value: field.extracted_value,
      total_time_seconds: timeSeconds
    });
  }
}

// Write merged file
fs.writeFileSync(outputFile, JSON.stringify(allRecords, null, 2));

console.log(`\n✅ Created ${outputFile} with ${allRecords.length} records`);
console.log(`Files processed: ${files.join(', ')}`);
