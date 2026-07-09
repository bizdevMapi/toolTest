import React, { useState } from 'react';
import { groundTruthAPI } from '../services/api';
import { toast } from 'react-toastify';

const GroundTruthUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile);
    } else {
      toast.error('Please select a valid JSON file');
      e.target.value = null;
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          const response = await groundTruthAPI.upload(jsonData);

          toast.success(response.data.message);
          setFile(null);
          document.getElementById('gt-file-input').value = null;

          if (onUploadSuccess) {
            onUploadSuccess();
          }
        } catch (error) {
          const message = error.response?.data?.message || 'Error uploading ground truth';
          toast.error(message);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      toast.error('Error reading file');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Upload Ground Truth Dataset</h2>
      <p className="text-gray-600 mb-4">
        Upload the baseline JSON file containing the ground truth data for all document types.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="gt-file-input" className="block text-sm font-medium text-gray-700 mb-2">
            Select Ground Truth JSON File
          </label>
          <input
            id="gt-file-input"
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-primary-50 file:text-primary-700
              hover:file:bg-primary-100
              cursor-pointer"
          />
        </div>

        {file && (
          <div className="text-sm text-gray-600">
            Selected: <span className="font-medium">{file.name}</span>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className={`w-full py-2 px-4 rounded-md font-semibold text-white transition-colors
            ${!file || loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700'
            }`}
        >
          {loading ? 'Uploading...' : 'Upload Ground Truth'}
        </button>
      </div>
    </div>
  );
};

export default GroundTruthUpload;
