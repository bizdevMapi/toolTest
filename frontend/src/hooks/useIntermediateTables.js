import { useState, useEffect, useRef } from 'react';
import { vendorAPI } from '../services/api';
import { toast } from 'react-toastify';

/**
 * Custom hook for loading intermediate tables
 * Handles loading state, error handling, and data fetching
 * Uses useRef to prevent double-call in React Strict Mode (development)
 */
export const useIntermediateTables = () => {
  const [tables, setTables] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasData, setHasData] = useState(false);
  const hasRun = useRef(false);

  const loadTables = async () => {
    setLoading(true);
    try {
      const response = await vendorAPI.getIntermediateTables();
      const data = response.data.data;

      // Check if we have any actual data
      const hasAnyData = data && Object.values(data).some(docType =>
        Array.isArray(docType) && docType.length > 0
      );

      if (hasAnyData) {
        setTables(data);
        setHasData(true);
        // toast.success('נתונים נטענו בהצלחה');
      } else {
        // No data available, but not an error
        setTables(null);
        setHasData(false);
        // toast.info('עדיין לא הועלו נתונים');
      }
    } catch (error) {
      console.error('Error loading intermediate tables:', error);
      setTables(null);
      setHasData(false);
      // toast.error('שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  // Load tables on mount (only once, even in React Strict Mode)
  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      loadTables();
    }
  }, []);

  return { tables, loading, hasData, loadTables };
};
