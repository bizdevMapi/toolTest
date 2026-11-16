import React from 'react';
import { documentTypeConfig, getColorClasses, getHeaderClasses, getAccuracyColorClass } from '../constants/documentTypes';
import { useIntermediateTables } from '../hooks/useIntermediateTables';

const IntermediateTables = () => {
  const { tables, loading, hasData, loadTables } = useIntermediateTables();

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
                  const accuracyColor = getAccuracyColorClass(row.accuracy_score);

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

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">⏳ טוען נתונים...</p>
        </div>
      ) : tables && hasData ? (
        <div>
          {Object.keys(documentTypeConfig).map(docType =>
            renderTable(docType, tables[docType])
          )}
        </div>
      ) : (
        <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-200 p-6">
          <p className="text-blue-700 font-semibold">📋 עדיין לא הועלו נתונים</p>
          <p className="text-blue-600 text-sm mt-2">כאשר יופעלו בדיקות על מסמכים, הנתונים יופיעו כאן</p>
        </div>
      )}
    </div>
  );
};

export default IntermediateTables;
