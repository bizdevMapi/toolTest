const fs = require('fs');
const path = require('path');

/**
 * המרת זמן בפורמט HH:MM:SS לשניות
 */
function timeToSeconds(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseInt(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * בדיקת חישוב זמן לקובץ בודד
 */
function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  const fileName = data.file_name;
  const startTime = data.start_time;
  const endTime = data.end_time;
  const totalTimeSeconds = data.total_time_seconds;

  // אם אין נתוני זמן
  if (!startTime || !endTime || totalTimeSeconds === null) {
    return {
      file: fileName,
      status: 'MISSING_DATA',
      startTime,
      endTime,
      totalTimeSeconds,
      message: 'חסרים נתוני זמן'
    };
  }

  const startSeconds = timeToSeconds(startTime);
  const endSeconds = timeToSeconds(endTime);
  const calculatedDiff = endSeconds - startSeconds;

  const isCorrect = calculatedDiff === totalTimeSeconds;

  return {
    file: fileName,
    status: isCorrect ? 'OK' : 'ERROR',
    startTime,
    endTime,
    totalTimeSeconds,
    calculatedDiff,
    diff: calculatedDiff - totalTimeSeconds,
    message: isCorrect ? '✅ נכון' : `❌ שגיאה! צריך להיות ${calculatedDiff} ולא ${totalTimeSeconds}`
  };
}

/**
 * בדיקת כל הקבצים בתיקייה
 */
function validateDirectory(dirPath, docType) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`בודק ${docType}...`);
  console.log('='.repeat(60));

  if (!fs.existsSync(dirPath)) {
    console.log(`❌ התיקייה לא קיימת: ${dirPath}`);
    return [];
  }

  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.json'))
    .sort();

  const results = [];
  let errorCount = 0;
  let missingCount = 0;
  let okCount = 0;

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const result = validateFile(filePath);
    results.push(result);

    if (result.status === 'ERROR') {
      errorCount++;
      console.log(`\n❌ ${result.file}:`);
      console.log(`   התחלה: ${result.startTime}`);
      console.log(`   סיום: ${result.endTime}`);
      console.log(`   רשום: ${result.totalTimeSeconds} שניות`);
      console.log(`   צריך להיות: ${result.calculatedDiff} שניות`);
      console.log(`   הפרש: ${result.diff} שניות`);
    } else if (result.status === 'MISSING_DATA') {
      missingCount++;
      console.log(`⚠️  ${result.file}: ${result.message}`);
    } else {
      okCount++;
      console.log(`✅ ${result.file}: ${result.totalTimeSeconds} שניות`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`סיכום ${docType}:`);
  console.log(`  ✅ נכון: ${okCount}`);
  console.log(`  ❌ שגוי: ${errorCount}`);
  console.log(`  ⚠️  חסר: ${missingCount}`);
  console.log(`  📊 סה"כ: ${files.length}`);

  return results;
}

// בדיקת כל סוגי המסמכים
console.log('\n🔍 מתחיל בדיקת חישוב זמן לכל נתוני ה-GT...\n');

const allResults = {
  garmushka: validateDirectory('./temp_garmushka/JSON', 'גרמושקה'),
  tazar: validateDirectory('./temp_tazar/JSON', 'תצ"ר'),
  permit: validateDirectory('./temp_permit/נתוני GT', 'היתרים')
};

// סיכום כללי
console.log(`\n${'='.repeat(60)}`);
console.log('סיכום כללי:');
console.log('='.repeat(60));

let totalErrors = 0;
let totalMissing = 0;
let totalOk = 0;

for (const [docType, results] of Object.entries(allResults)) {
  if (results.length > 0) {
    const errors = results.filter(r => r.status === 'ERROR').length;
    const missing = results.filter(r => r.status === 'MISSING_DATA').length;
    const ok = results.filter(r => r.status === 'OK').length;

    totalErrors += errors;
    totalMissing += missing;
    totalOk += ok;
  }
}

console.log(`  ✅ נכון: ${totalOk}`);
console.log(`  ❌ שגוי: ${totalErrors}`);
console.log(`  ⚠️  חסר: ${totalMissing}`);
console.log(`  📊 סה"כ: ${totalOk + totalErrors + totalMissing}`);

if (totalErrors === 0 && totalMissing === 0) {
  console.log(`\n🎉 כל חישובי הזמן נכונים!`);
  process.exit(0);
} else if (totalErrors > 0) {
  console.log(`\n⚠️  נמצאו ${totalErrors} שגיאות בחישוב זמן!`);
  process.exit(1);
} else {
  console.log(`\n⚠️  יש ${totalMissing} קבצים ללא נתוני זמן.`);
  process.exit(0);
}
