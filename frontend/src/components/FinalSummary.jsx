import React, { useMemo } from 'react';
import { documentTypeConfig } from '../constants/documentTypes';
import { useIntermediateTables } from '../hooks/useIntermediateTables';

const FinalSummary = () => {
  const { tables, loading, loadTables } = useIntermediateTables();

  // Calculate total score for each vendor across all document types (memoized)
  const vendorTotals = useMemo(() => {
    if (!tables) return [];

    const vendorTotals = {};

    Object.keys(documentTypeConfig).forEach(docType => {
      if (tables[docType]) {
        tables[docType].forEach(row => {
          if (!vendorTotals[row.vendor_name]) {
            vendorTotals[row.vendor_name] = {
              vendor_name: row.vendor_name,
              total_accuracy: 0,
              total_time: 0
            };
          }
          vendorTotals[row.vendor_name].total_accuracy += row.weighted_score;
          vendorTotals[row.vendor_name].total_time += row.time_score;
        });
      }
    });

    // Convert to array and sort by total score descending
    return Object.values(vendorTotals)
      .map(vendor => ({
        ...vendor,
        total_score: vendor.total_accuracy + vendor.total_time
      }))
      .sort((a, b) => b.total_score - a.total_score);
  }, [tables]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">סיכום סופי - סה"כ ציונים</h2>
        <button
          onClick={loadTables}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? '⏳ טוען...' : '🔄 רענן'}
        </button>
      </div>

      <p className="text-gray-600 mb-6">
        טבלה מסכמת של סך כל הציונים לכל ספק בכל סוגי המסמכים
      </p>

      {vendorTotals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          אין נתונים זמינים. נא לטעון את טבלאות הביניים תחילה.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-300 to-purple-300">
                <th className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-800">דירוג</th>
                <th className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-800">שם ספק</th>
                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800">סכום ציוני דיוק</th>
                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800">סכום ציוני זמן</th>
                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800">סה"כ סופי</th>
              </tr>
            </thead>
            <tbody>
              {vendorTotals.map((vendor, idx) => (
                <tr
                  key={vendor.vendor_name}
                  className={`
                    ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    ${idx === 0 ? 'bg-yellow-100' : ''}
                    hover:bg-blue-100 transition-colors
                  `}
                >
                  <td className="border border-gray-300 px-4 py-3 text-right">
                    {idx === 0 ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-yellow-400 text-yellow-900">
                        🏆 #{idx + 1}
                      </span>
                    ) : (
                      <span className="font-medium text-gray-700">#{idx + 1}</span>
                    )}
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-800">
                    {vendor.vendor_name}
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <span className="inline-flex px-3 py-1 bg-green-100 text-green-800 rounded-full font-bold">
                      {vendor.total_accuracy.toFixed(2)}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <span className="inline-flex px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-bold">
                      {vendor.total_time.toFixed(2)}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-center font-bold text-lg">
                    <span className="inline-flex px-4 py-2 bg-purple-200 text-purple-900 rounded-full">
                      {vendor.total_score.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Winner Section */}
      {vendorTotals.length > 0 && (
        <div className="mt-8 p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-r-4 border-yellow-400 rounded-lg">
          <div className="flex items-center justify-end gap-4">
            <div className="text-right">
              <h3 className="text-xl font-bold text-gray-800">
                זוכה: {vendorTotals[0].vendor_name}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                ציון דיוק: {vendorTotals[0].total_accuracy.toFixed(2)} | ציון זמן: {vendorTotals[0].total_time.toFixed(2)}
              </p>
              <p className="text-lg font-bold text-purple-700 mt-2">
                סה"כ: {vendorTotals[0].total_score.toFixed(2)} נקודות
              </p>
            </div>
            <span className="text-5xl">🏆</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinalSummary;
