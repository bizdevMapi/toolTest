import { useState, useEffect } from 'react';
import { vendorAPI } from '../services/api';
import { toast } from 'react-toastify';

/**
 * Custom hook for loading intermediate tables
 * Handles loading state, error handling, and data fetching
 */
export const useIntermediateTables = () => {
  const [tables, setTables] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadTables = async () => {
    setLoading(true);
    try {
      const response = await vendorAPI.getIntermediateTables();
      setTables(response.data.data);
      toast.success('נתונים נטענו בהצלחה');
    } catch (error) {
      console.error('Error loading intermediate tables:', error);
      toast.error('שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  // Load tables on mount
  useEffect(() => {
    loadTables();
  }, []);

  return { tables, loading, loadTables };
};
