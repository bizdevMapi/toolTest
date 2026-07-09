/**
 * בדיקה פשוטה של לוגיקת ולידציית זמן
 * ללא תלות ב-axios או בשרת רץ
 *
 * הרצה: node tests/time-validation-simple.js
 */

/**
 * פונקציית המרה - העתק מהקוד האמיתי
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
 * ולידציית חישוב זמן - העתק מהקוד האמיתי
 */
function validateTimeCalculation(startTime, endTime, reportedSeconds) {
  if (!startTime || !endTime || reportedSeconds === null) {
    return { valid: true, message: 'No time data to validate' };
  }

  const startSeconds = timeToSeconds(startTime);
  const endSeconds = timeToSeconds(endTime);

  if (startSeconds === null || endSeconds === null) {
    return { valid: false, message: 'Invalid time format' };
  }

  const calculatedDiff = endSeconds - startSeconds;

  if (calculatedDiff !== reportedSeconds) {
    return {
      valid: false,
      message: `Time calculation error: start=${startTime}, end=${endTime}, reported=${reportedSeconds}s, should be ${calculatedDiff}s`
    };
  }

  return { valid: true, message: 'Time calculation is correct' };
}

/**
 * הרצת בדיקות
 */
function runTests() {
  console.log('\n🧪 בדיקות ולידציית זמן\n');
  console.log('='.repeat(70));

  const tests = [
    {
      name: 'חישוב נכון - דקה וחצי',
      start: '08:00:00',
      end: '08:01:30',
      reported: 90,
      expectValid: true
    },
    {
      name: 'חישוב נכון - 73 שניות',
      start: '08:02:42',
      end: '08:03:55',
      reported: 73,
      expectValid: true
    },
    {
      name: 'חישוב שגוי - דיווח חסר',
      start: '08:00:00',
      end: '08:01:30',
      reported: 85,
      expectValid: false
    },
    {
      name: 'חישוב שגוי - דיווח עודף',
      start: '08:00:00',
      end: '08:01:30',
      reported: 95,
      expectValid: false
    },
    {
      name: 'חישוב נכון - זמן 0',
      start: '10:00:00',
      end: '10:00:00',
      reported: 0,
      expectValid: true
    },
    {
      name: 'חישוב נכון - דקה שלמה',
      start: '10:15:00',
      end: '10:16:00',
      reported: 60,
      expectValid: true
    },
    {
      name: 'חישוב נכון - שעה שלמה',
      start: '09:00:00',
      end: '10:00:00',
      reported: 3600,
      expectValid: true
    },
    {
      name: 'חישוב נכון - קרוב לחצות',
      start: '23:59:00',
      end: '23:59:45',
      reported: 45,
      expectValid: true
    },
    {
      name: 'חישוב שגוי - הפרש של שנייה אחת',
      start: '10:00:00',
      end: '10:01:00',
      reported: 59,
      expectValid: false
    },
    {
      name: 'חישוב נכון - 2 דקות ו-17 שניות',
      start: '14:30:15',
      end: '14:32:32',
      reported: 137,
      expectValid: true
    }
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test, index) => {
    const result = validateTimeCalculation(test.start, test.end, test.reported);
    const testPassed = result.valid === test.expectValid;

    if (testPassed) {
      console.log(`\n✅ בדיקה ${index + 1}: ${test.name}`);
      console.log(`   ${test.start} → ${test.end} = ${test.reported}s`);
      console.log(`   ${result.message}`);
      passed++;
    } else {
      console.log(`\n❌ בדיקה ${index + 1}: ${test.name}`);
      console.log(`   ${test.start} → ${test.end} = ${test.reported}s`);
      console.log(`   ציפינו: ${test.expectValid ? 'תקין' : 'שגוי'}`);
      console.log(`   קיבלנו: ${result.valid ? 'תקין' : 'שגוי'}`);
      console.log(`   ${result.message}`);
      failed++;
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('סיכום:');
  console.log('='.repeat(70));
  console.log(`✅ עברו: ${passed}`);
  console.log(`❌ נכשלו: ${failed}`);
  console.log(`📊 סה"כ: ${tests.length}`);
  console.log(`📈 אחוז הצלחה: ${Math.round((passed / tests.length) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 כל הבדיקות עברו בהצלחה!');
    console.log('\n✅ לוגיקת הולידציה עובדת כראוי.');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} בדיקות נכשלו!`);
    process.exit(1);
  }
}

// הרצת הבדיקות
runTests();
