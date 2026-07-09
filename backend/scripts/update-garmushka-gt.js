/**
 * סקריפט לעדכון נתוני אמת לגרמושקה
 *
 * שימוש:
 * 1. ערוך את המערך garmushkaGroundTruth למטה עם הנתונים החדשים
 * 2. הרץ: node scripts/update-garmushka-gt.js
 *
 * פורמט:
 * - file_name: שם הקובץ (לדוגמה: "G1", "G2", וכו')
 * - השדות הנתמכים לגרמושקה:
 *   * gush - מספר גוש
 *   * parcel - מספר חלקה
 *   * building_num - מספר בניין
 *   * primary_use - סוג שימוש עיקרי
 *
 * חשוב: שמות השדות חייבים להיות מדויקים! (ראה STRICT_MODE_WARNING.md)
 */

const mongoose = require('mongoose');
const GroundTruth = require('../models/GroundTruth');
const { normalizeValue } = require('../utils/normalization');

// הגדר את נתוני האמת כאן
const garmushkaGroundTruth = [
  // G1
  {
    file_name: 'G1',
    gush: '1234',
    parcel: '56,78',
    building_num: '100',
    primary_use: 'מגורים'
  },
  // G2
  {
    file_name: 'G2',
    gush: '5678',
    parcel: '90',
    building_num: '200',
    primary_use: 'מסחר'
  },
  // G3
  {
    file_name: 'G3',
    gush: '9101',
    parcel: '11,12,13',
    building_num: 'NULL',
    primary_use: 'תעשייה'
  },
  // G4
  {
    file_name: 'G4',
    gush: '1415',
    parcel: '16',
    building_num: '300',
    primary_use: 'ציבורי'
  },
  // G5
  {
    file_name: 'G5',
    gush: '1718',
    parcel: '19,20',
    building_num: '400',
    primary_use: 'מגורים'
  }
];

// השדות הנתמכים לגרמושקה
const GARMUSHKA_FIELDS = ['gush', 'parcel', 'building_num', 'primary_use'];

async function updateGarmushkaGroundTruth() {
  try {
    console.log('🔌 מתחבר ל-MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/vendor-evaluation', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ התחברות הצליחה\n');

    // המרת הנתונים לפורמט המערכת
    const records = [];
    for (const fileData of garmushkaGroundTruth) {
      const fileName = fileData.file_name;

      for (const field of GARMUSHKA_FIELDS) {
        const value = fileData[field] || 'NULL';
        records.push({
          file_name: fileName,
          document_type: 'garmushka',
          field_name: field,
          expected_value: normalizeValue(value)
        });
      }
    }

    console.log(`📝 מעדכן ${records.length} רשומות עבור גרמושקה...`);
    console.log(`   (${garmushkaGroundTruth.length} קבצים × ${GARMUSHKA_FIELDS.length} שדות)\n`);

    // מחיקת נתוני גרמושקה קיימים
    const deleteResult = await GroundTruth.deleteMany({ document_type: 'garmushka' });
    console.log(`🗑️  נמחקו ${deleteResult.deletedCount} רשומות קיימות`);

    // הכנסת נתונים חדשים
    const insertResult = await GroundTruth.insertMany(records, { ordered: false });
    console.log(`✅ הוכנסו ${insertResult.length} רשומות חדשות\n`);

    // הצגת סיכום
    console.log('📊 סיכום נתוני אמת לגרמושקה:');
    console.log('─'.repeat(50));

    const summary = await GroundTruth.aggregate([
      { $match: { document_type: 'garmushka' } },
      { $group: { _id: '$file_name', fields: { $push: { field: '$field_name', value: '$expected_value' } } } },
      { $sort: { _id: 1 } }
    ]);

    for (const item of summary) {
      console.log(`\n📄 ${item._id}:`);
      for (const field of item.fields) {
        console.log(`   ${field.field}: ${field.value}`);
      }
    }

    console.log('\n✅ העדכון הושלם בהצלחה!');

  } catch (error) {
    console.error('❌ שגיאה:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 ההתחברות נסגרה');
  }
}

// הרצת הסקריפט
updateGarmushkaGroundTruth();
