import React, { useState, useEffect } from 'react';
import { vendorAPI } from '../services/api';
import ScoreBreakdown from './ScoreBreakdown';

const ScoreBreakdownPage = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען תוצאות...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg">אין תוצאות זמינות</p>
          <p className="text-sm mt-2">בואו להעלות נתונים וחישוב ציונים סופיים קודם</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2 text-right">📊 ניתוח מפורט של הניקוד</h2>
        <p className="text-gray-600 text-right">
          צפה בפרוט מלא של כל הנתונים שהעלה כל ספק ולמה ירד כל ניקוד
        </p>
      </div>

      <div className="space-y-6">
        {results.map((result) => (
          <ScoreBreakdown
            key={result._id}
            vendorName={result.vendor_name}
            result={result}
          />
        ))}
      </div>
    </div>
  );
};

export default ScoreBreakdownPage;
