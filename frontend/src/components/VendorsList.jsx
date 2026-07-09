import React, { useState, useEffect } from 'react';
import { vendorAPI } from '../services/api';

const VendorsList = ({ refresh }) => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, [refresh]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await vendorAPI.getSubmissions();
      const uniqueVendors = [...new Set(response.data.vendors)];
      setVendors(uniqueVendors);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Uploaded Vendors</h3>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Uploaded Vendors</h3>
      {vendors.length === 0 ? (
        <p className="text-gray-500 text-sm">No vendors uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {vendors.map((vendor, index) => (
            <li key={index} className="flex items-center text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
              <span className="text-gray-700 font-medium">{vendor}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default VendorsList;
