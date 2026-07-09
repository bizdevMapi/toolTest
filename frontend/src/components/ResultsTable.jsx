import React, { useState, useEffect } from 'react';
import { vendorAPI } from '../services/api';
import { toast } from 'react-toastify';

const ResultsTable = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await vendorAPI.getResults();
      setResults(response.data.data);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const response = await vendorAPI.calculateFinal();
      toast.success(response.data.message);
      await fetchResults();
    } catch (error) {
      const message = error.response?.data?.message || 'Error calculating final scores';
      toast.error(message);
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  const DOC_TYPE_LABELS = {
    permit: 'היתר בנייה מילולי',
    garmushka: 'גרמושקה',
    tazar: 'תצ"ר',
    mavat: 'מבא"ת'
  };

  const FIELD_LABELS = {
    setl: 'יישוב',
    gush: 'גוש',
    parcel: 'חלקה',
    bld_num: 'מספר בניין'
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">תוצאות הערכה</h2>
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className={`py-2 px-6 rounded-md font-semibold text-white transition-colors
            ${calculating
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          {calculating ? 'מחשב ציונים...' : 'חשב ציונים סופיים'}
        </button>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          אין תוצאות זמינות. העלה נתוני מציעים ולחץ על "חשב ציונים סופיים".
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">דירוג</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">מציע</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">דיוק כללי (%)</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">ציון זמן כללי</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">ציון כולל</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">פירוט</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((result) => (
                  <React.Fragment key={result._id}>
                    <tr className={`hover:bg-gray-50 ${result.rank === 1 ? 'bg-yellow-50' : ''}`}>
                      <td className="px-4 py-3 text-right">
                        {result.rank === 1 ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-yellow-400 text-yellow-900">
                            🏆 #{result.rank}
                          </span>
                        ) : (
                          <span className="font-medium text-gray-700">#{result.rank}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 text-right">
                        {result.vendor_name}
                        {result.rank === 1 && (
                          <span className="mr-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            מציע זוכה
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{result.overall_accuracy}</td>
                      <td className="px-4 py-3 text-center font-medium">{result.overall_time_score}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-primary-100 text-primary-800">
                          {result.total_score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            const detailsRow = document.getElementById(`details-${result._id}`);
                            detailsRow.classList.toggle('hidden');
                          }}
                          className="text-primary-600 hover:text-primary-800 font-medium"
                        >
                          הצג/הסתר פירוט
                        </button>
                      </td>
                    </tr>
                    <tr id={`details-${result._id}`} className="hidden bg-gray-50">
                      <td colSpan="6" className="px-4 py-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <h4 className="font-semibold text-gray-800 mb-3 text-right">פירוט לפי סוג מסמך</h4>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {result.document_type_scores.map((docScore) => (
                              <div key={docScore.document_type} className="border rounded-lg p-3">
                                <h5 className="font-medium text-gray-700 mb-2 text-right">
                                  {DOC_TYPE_LABELS[docScore.document_type] || docScore.document_type}
                                </h5>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">דיוק:</span>
                                    <span className="font-medium">{docScore.accuracy_score.toFixed(2)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">זמן מדיאני:</span>
                                    <span className="font-medium">{docScore.median_time.toFixed(2)}s</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">ציון זמן:</span>
                                    <span className="font-medium">{docScore.time_score.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {results.length > 0 && results[0].rank === 1 && (
            <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-green-50 border-r-4 border-yellow-400 rounded-lg">
              <div className="flex items-center justify-end">
                <div className="text-right">
                  <h3 className="text-lg font-bold text-gray-800">
                    זוכה: {results[0].vendor_name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    ציון כולל: {results[0].total_score} (דיוק: {results[0].overall_accuracy}, זמן: {results[0].overall_time_score})
                  </p>
                </div>
                <span className="text-3xl ml-3">🏆</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResultsTable;
