import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { groundTruthAPI, vendorAPI } from '../services/api';
import { documentTypeConfig } from '../constants/documentTypes';

const VendorUpload = () => {
  const [vendorName, setVendorName] = useState('');
  const [zipFiles, setZipFiles] = useState({
    permit: null,
    garmushka: null,
    tazar: null,
    mavat: null
  });
  const [timeValues, setTimeValues] = useState({
    permit: '',
    garmushka: '',
    tazar: '',
    mavat: ''
  });
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadComplete, setUploadComplete] = useState(false);
  const [availableDocTypes, setAvailableDocTypes] = useState({
    permit: true,
    garmushka: true,
    tazar: false,
    mavat: false
  });

  useEffect(() => {
    // Check which document types have ground truth data
    const checkAvailableDocTypes = async () => {
      try {
        const response = await groundTruthAPI.getAvailable();
        const availableTypes = response.data.available_document_types || [];

        setAvailableDocTypes({
          permit: availableTypes.includes('permit'),
          garmushka: availableTypes.includes('garmushka'),
          tazar: availableTypes.includes('tazar'),
          mavat: availableTypes.includes('mavat')
        });
      } catch (error) {
        console.error('Error checking available document types:', error);
      }
    };

    checkAvailableDocTypes();
  }, []);

  const handleFileChange = (documentType, e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const isZip = selectedFile.name.toLowerCase().endsWith('.zip') ||
                    selectedFile.type === 'application/zip' ||
                    selectedFile.type === 'application/x-zip-compressed';

      if (isZip) {
        setZipFiles(prev => ({ ...prev, [documentType]: selectedFile }));
      } else {
        toast.error('נא לבחור קובץ ZIP תקין');
        e.target.value = null;
      }
    }
  };

  const handleTimeChange = (documentType, e) => {
    const value = e.target.value;
    // Allow only numbers
    if (value === '' || /^\d+$/.test(value)) {
      setTimeValues(prev => ({ ...prev, [documentType]: value }));
    }
  };

  const handleUploadAll = async () => {
    if (!vendorName.trim()) {
      toast.error('נא להזין שם מציע');
      return;
    }

    // Check which files are selected
    const selectedFiles = Object.keys(zipFiles).filter(docType => zipFiles[docType]);

    if (selectedFiles.length === 0) {
      toast.error('נא לבחור לפחות קובץ ZIP אחד');
      return;
    }

    setLoading(true);
    setUploadProgress({});

    let successCount = 0;
    let errorCount = 0;

    // Upload each selected file
    for (const documentType of selectedFiles) {
      setUploadProgress(prev => ({ ...prev, [documentType]: 'uploading' }));

      try {
        const formData = new FormData();
        formData.append('vendor_name', vendorName.trim());
        formData.append('zipFile', zipFiles[documentType]);
        formData.append('document_type', documentType);
        if (timeValues[documentType]) {
          formData.append('time_seconds', timeValues[documentType]);
        }

        const response = await vendorAPI.uploadZip(formData);

        setUploadProgress(prev => ({ ...prev, [documentType]: 'success' }));
        successCount++;

        toast.success(`✅ ${documentTypeConfig[documentType].title}: ${response.data.files_processed} קבצים`, {
          autoClose: 2000
        });

      } catch (error) {
        setUploadProgress(prev => ({ ...prev, [documentType]: 'error' }));
        errorCount++;

        const message = error.response?.data?.message || 'שגיאה';
        toast.error(`❌ ${documentTypeConfig[documentType].title}: ${message}`);
      }
    }

    setLoading(false);

    // Final summary
    if (successCount > 0 && errorCount === 0) {
      // כל המסמכים הועלו בהצלחה
      toast.success(`🎉 כל המסמכים הועלו בהצלחה!`, {
        autoClose: 5000
      });

      setUploadComplete(true);

      // Clear uploaded files
      setZipFiles({
        permit: null,
        garmushka: null,
        tazar: null,
        mavat: null
      });

      // Clear time values
      setTimeValues({
        permit: '',
        garmushka: '',
        tazar: '',
        mavat: ''
      });

      // Clear file inputs
      selectedFiles.forEach(docType => {
        const input = document.getElementById(`zip-file-input-${docType}`);
        if (input) input.value = null;
      });

      setUploadProgress({});
    } else if (successCount > 0 && errorCount > 0) {
      // חלק מהקבצים נכשלו
      toast.warning(`⚠️ הועלו ${successCount} מתוך ${selectedFiles.length} סוגי מסמכים`, {
        autoClose: 5000
      });
    }
  };

  const handleReset = () => {
    setUploadComplete(false);
    setVendorName('');
  };

  const documentTypeConfig = {
    permit: {
      title: 'היתר בנייה מילולי',
      description: 'קבצי JSON עם תוצאות חילוץ המידע',
      fields: ['setl', 'gush', 'parcel', 'bld_num'],
      examples: 'P1-P10',
      color: 'blue'
    },
    garmushka: {
      title: 'גרמושקה',
      description: 'קבצי JSON עם תוצאות חילוץ המידע',
      fields: ['gush', 'parcel', 'bld_num', 'primary_use'],
      examples: 'G1-G5',
      color: 'green'
    },
    tazar: {
      title: 'תצ"ר',
      description: 'קבצי JSON עם תוצאות חילוץ המידע',
      fields: ['gush', 'parcel', 'bld_num', 'plan_num'],
      examples: 'T1-T10',
      color: 'purple'
    },
    mavat: {
      title: 'מבא"ת',
      description: 'קבצי JSON עם תוצאות חילוץ המידע',
      fields: ['gush', 'parcel', 'plot_size', 'primary_use'],
      examples: 'M1-M10',
      color: 'orange'
    }
  };

  const getBorderClasses = (color) => {
    const colorMap = {
      blue: 'border-blue-200 bg-blue-50',
      green: 'border-green-200 bg-green-50',
      purple: 'border-purple-200 bg-purple-50',
      orange: 'border-orange-200 bg-orange-50'
    };
    return colorMap[color] || 'border-blue-200 bg-blue-50';
  };

  const renderDocumentTypeCard = (docType) => {
    const config = documentTypeConfig[docType];
    const hasFile = zipFiles[docType];
    const progress = uploadProgress[docType];
    const isAvailable = availableDocTypes[docType];

    return (
      <div key={docType} className={`border-2 rounded-lg p-4 ${getBorderClasses(config.color)} ${!isAvailable ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-800">{config.title}</h3>
          <div className="flex items-center gap-2">
            {!isAvailable && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">לא זמין</span>}
            {hasFile && !progress && <span className="text-green-600 text-xl">✓</span>}
            {progress === 'uploading' && <span className="text-blue-600 text-xl">⏳</span>}
            {progress === 'success' && <span className="text-green-600 text-xl">✅</span>}
            {progress === 'error' && <span className="text-red-600 text-xl">❌</span>}
          </div>
        </div>

        {!isAvailable && (
          <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
            ⚠️ נתוני אמת עדיין לא הועלו למערכת עבור סוג מסמך זה
          </div>
        )}

        <p className="text-sm text-gray-600 mb-3">{config.description}</p>

        <div className="mb-3 text-xs text-gray-600 bg-white p-2 rounded">
          <p className="font-semibold mb-1">שדות נדרשים:</p>
          <p className="mr-2">{config.fields.join(', ')}</p>
          <p className="text-xs text-gray-500 mt-1">דוגמאות: {config.examples}</p>
        </div>

        <input
          id={`zip-file-input-${docType}`}
          type="file"
          accept=".zip"
          onChange={(e) => handleFileChange(docType, e)}
          disabled={loading || !isAvailable}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-white file:text-gray-700
            hover:file:bg-gray-100
            cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {hasFile && (
          <>
            <p className="text-xs text-gray-600 mt-2" dir="ltr">📦 {hasFile.name}</p>

            <div className="mt-3 p-3 bg-white border border-gray-200 rounded-md">
              <label htmlFor={`time-input-${docType}`} className="block text-sm font-medium text-gray-700 mb-2">
                זמן בהפעלה (שניות) <span className="text-red-500">*</span>
              </label>
              <input
                id={`time-input-${docType}`}
                type="number"
                min="0"
                step="1"
                value={timeValues[docType]}
                onChange={(e) => handleTimeChange(docType, e)}
                disabled={loading}
                placeholder="הכנס זמן בשניות"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                dir="rtl"
              />
              <p className="text-xs text-gray-500 mt-1">זמן בהפעלה של הבדיקה</p>
            </div>
          </>
        )}
      </div>
    );
  };

  // אם ההעלאה הסתיימה בהצלחה, הצג מסך הצלחה
  if (uploadComplete) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-md p-8 border-2 border-green-200">
        <div className="text-center">
          <div className="mb-4 text-6xl animate-bounce">✅</div>
          <h2 className="text-3xl font-bold text-green-700 mb-3">כל המסמכים הועלו בהצלחה!</h2>
          <p className="text-green-600 text-lg mb-2">המערכת קיבלה את כל הקבצים ומעבדת את התוצאות</p>
          <p className="text-green-500 text-sm mb-8">אתה יכול לעבור לדף הבדיקות כדי לראות את התוצאות</p>

          <button
            onClick={handleReset}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-all transform hover:scale-[1.05] shadow-lg"
          >
            🔄 העלה מציע חדש
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">העלאת תוצאות מציע</h2>
      <p className="text-gray-600 mb-6">
        העלה קבצי ZIP עבור כל סוג מסמך בנפרד. כל ZIP צריך להכיל קבצי JSON עם תוצאות החילוץ.
      </p>

      <div className="mb-6">
        <label htmlFor="vendor-name" className="block text-sm font-medium text-gray-700 mb-2">
          שם המציע <span className="text-red-500">*</span>
        </label>
        <input
          id="vendor-name"
          type="text"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          placeholder="הזן שם מציע"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          dir="rtl"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {Object.keys(documentTypeConfig).map(docType => renderDocumentTypeCard(docType))}
      </div>

      <div className="border-t pt-6">
        <button
          onClick={handleUploadAll}
          disabled={loading || !vendorName.trim() || Object.values(zipFiles).every(f => !f)}
          className={`w-full py-4 px-6 rounded-lg font-bold text-white text-lg transition-all shadow-lg
            ${loading || !vendorName.trim() || Object.values(zipFiles).every(f => !f)
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transform hover:scale-[1.02]'
            }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              מעלה ומעבד קבצים...
            </span>
          ) : (
            <span>🚀 העלה והפעל בדיקת דיוק</span>
          )}
        </button>

        {!loading && Object.values(zipFiles).filter(f => f).length > 0 && (
          <p className="text-center text-sm text-gray-600 mt-3">
            נבחרו {Object.values(zipFiles).filter(f => f).length} מתוך 4 סוגי מסמכים
          </p>
        )}
      </div>
    </div>
  );
};

export default VendorUpload;
