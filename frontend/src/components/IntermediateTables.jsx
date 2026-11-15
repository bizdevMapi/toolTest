import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL = 'http://localhost:5000/api';

const IntermediateTables = () => {
  const [tables, setTables] = useState(null);
  const [loading, setLoading] = useState(false);

  const documentTypeConfig = {
    permit: { title: 'היתר בנייה מילולי', color: 'blue', weight: 5 },
    garmushka: { title: 'גרמושקה', color: 'green', weight: 5 },
    tazar: { title: 'תצ"ר', color: 'purple', weight: 20 },
    mavat: { title: 'מבא"ת', color: 'orange', weight: 20 }
  };

  const loadTables = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/vendor/intermediate-tables`);
      setTables(response.data.data);
      toast.success('טבלאות ביניים נטענו בהצלחה');
    } catch (error) {
      console.error('Error loading intermediate tables:', error);
      toast.error('שגיאה בטעינת הטבלאות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const getColorClasses = (color) => {
    const colorMap = {
      blue: 'border-blue-300 bg-blue-50',
      green: 'border-green-300 bg-green-50',
      purple: 'border-purple-300 bg-purple-50',
      orange: 'border-orange-300 bg-orange-50'
    };
    return colorMap[color] || 'border-blue-300 bg-blue-50';
  };

  const getHeaderClasses = (color) => {
    const colorMap = {
      blue: 'bg-blue-200',
      green: 'bg-green-200',
      purple: 'bg-purple-200',
      orange: 'bg-orange-200'
    };
    return colorMap[color] || 'bg-blue-200';
  };

  const renderTable = (docType, rows) => {
    const config = documentTypeConfig[docType];

    return (
      <div key={docType} className={`border-2 rounded-lg p-4 ${getColorClasses(config.color)} mb-6`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">{config.title}</h3>
          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
            משקל: {config.weight} נקודות
          </span>
        </div>

        {rows && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className={getHeaderClasses(config.color)}>
                  <th className="border border-gray-300 px-4 py-2 text-right font-bold">שם ספק</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-bold">דיוק (%)</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-bold">ציון דיוק</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-bold">זמן (ש')</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-bold">ציון זמן</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  // Color code the accuracy score based on threshold
                  let accuracyColor = 'text-gray-500'; // Below threshold
                  if (row.accuracy_score >= 80) {
                    accuracyColor = 'text-green-700 font-bold'; // Above threshold
                  }

                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-4 py-2 text-right">{row.vendor_name}</td>
                      <td className={`border border-gray-300 px-4 py-2 text-center font-semibold ${accuracyColor}`}>
                        <div>
                          {row.accuracy_score}%
                          {row.accuracy_score < 80 && <span className="text-red-500 text-xs"> (לא עבר)</span>}
                        </div>
                      </td>
                      <td className={`border border-gray-300 px-4 py-2 text-center font-bold ${accuracyColor}`}>
                        {row.weighted_score}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        <div className="text-sm">
                          {row.median_time}s
                          {row.min_time && <div className="text-xs text-gray-500">(מינ': {row.min_time}s)</div>}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-bold text-blue-700">
                        {row.time_score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 text-center py-4">אין נתונים זמינים</p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">טבלאות ביניים - דיוק וזמן</h2>
        <button
          onClick={loadTables}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? '⏳ טוען...' : '🔄 רענן'}
        </button>
      </div>

      <p className="text-gray-600 mb-6">
        הטבלאות מציגות את ציון הדיוק הממוצע וזמן הביצוע החציוני לכל ספק בכל סוג מסמך
      </p>

      {tables ? (
        <div>
          {Object.keys(documentTypeConfig).map(docType =>
            renderTable(docType, tables[docType])
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">טוען נתונים...</p>
        </div>
      )}
    </div>
  );
};

export default IntermediateTables;
