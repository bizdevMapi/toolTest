const fs = require('fs');
const http = require('http');

const filePath = './ground-truth-garmushka.json';
const data = fs.readFileSync(filePath, 'utf8');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/gt/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log(`📤 מעלה ${filePath} למערכת...`);

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`\n✅ סטטוס: ${res.statusCode}`);
    console.log('תגובה:', body);
  });
});

req.on('error', (e) => {
  console.error('❌ שגיאה:', e.message);
  process.exit(1);
});

req.write(data);
req.end();
