import React, { useState, useEffect } from 'react';
import { vendorAPI } from '../services/api';
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';

const ScoreBreakdown = ({ vendorName, result }) => {
  const [expanded, setExpanded] = useState(false);
  const [submissionHistory, setSubmissionHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSubmissionHistory = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setLoading(true);
    try {
      const response = await vendorAPI.getVendorSubmissionHistory(vendorName);
      setSubmissionHistory(response.data.data);
      setExpanded(true);
    } catch (error) {
      console.error('Error fetching submission history:', error);
    } finally {
      setLoading(false);
    }
  };

  const DOC_TYPE_LABELS = {
    permit: 'היתר בנייה מילולי',
    garmushka: 'גרמושקה',
    tazar: 'תצ"ר',
    mavat: 'מבא"ת'
  };

  const getScoreColor = (accuracy) => {
    if (accuracy >= 95) return 'text-green-600 bg-green-50 border-green-200';
    if (accuracy >= 80) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (accuracy >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const renderDocTypeBreakdown = () => {
    if (!result.document_type_scores) return null;

    return result.document_type_scores.map((docScore) => {
      const threshold = 80;
      const isGood = docScore.accuracy_score >= threshold;

      return (
        <div key={docScore.document_type} className="border rounded p-2 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-xs">
                {DOC_TYPE_LABELS[docScore.document_type] || docScore.document_type}
              </p>
              <p className="text-xs text-gray-600">משקל: {docScore.weight_percentage}%</p>
            </div>
            <div className="text-center ml-2">
              <p className={`text-sm font-bold ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                {docScore.accuracy_score.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-600 flex gap-1">
                <span>⏱️ {docScore.median_time.toFixed(0)}s</span>
                <span>📊 {docScore.time_score.toFixed(1)}</span>
              </p>
            </div>
          </div>
        </div>
      );
    });
  };

  const renderSubmissionDetails = () => {
    if (!submissionHistory) return null;

    const documentTypes = ['permit', 'garmushka', 'tazar', 'mavat'];

    return documentTypes.map((docType) => {
      const data = submissionHistory[docType];
      if (!data || data.submissions.length === 0) return null;

      const correctCount = data.stats.correct_fields;
      const totalCount = data.stats.total_fields;

      return (
        <div key={docType} className="mb-3 border rounded overflow-hidden">
          {/* Header - Compact */}
          <div className="bg-blue-50 p-2 border-b flex justify-between items-center">
            <div>
              <p className="font-bold text-xs text-gray-800">
                {DOC_TYPE_LABELS[docType] || docType}
              </p>
              <p className="text-xs text-gray-600">
                {correctCount}/{totalCount} נכון ({data.stats.accuracy_percentage}%)
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-blue-600">{data.stats.accuracy_percentage}%</p>
            </div>
          </div>

          {/* Submissions - Compact */}
          <div className="bg-white text-xs">
            {data.submissions.map((sub, idx) => {
              const accuracy = (sub.accuracy_score * 100).toFixed(0);
              const isGood = sub.accuracy_score === 1;
              const isPartial = sub.accuracy_score > 0 && sub.accuracy_score < 1;
              const isBad = sub.accuracy_score === 0;

              return (
              <div
                key={idx}
                className={`p-2 border-b last:border-b-0 ${
                  isGood ? 'bg-green-50' : isPartial ? 'bg-yellow-50' : 'bg-red-50'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="flex gap-1 items-center">
                      {isGood ? (
                        <span className="text-green-600 font-bold">✓</span>
                      ) : isPartial ? (
                        <span className="text-yellow-600 font-bold">◐</span>
                      ) : (
                        <span className="text-red-600 font-bold">✗</span>
                      )}
                      <p className="font-semibold text-gray-700">{sub.file_name}</p>
                      <p className="text-gray-600">/ {sub.field_name}</p>
                      <span className={`ml-auto text-sm font-bold ${
                        isGood ? 'text-green-600' : isPartial ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {accuracy}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Values - Show normalized for comparison */}
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-1 rounded border border-gray-200">
                    <p className="text-gray-600 font-semibold">📤:</p>
                    <p className="font-mono text-gray-800 break-words">{sub.normalized_value || '(ריק)'}</p>
                  </div>
                  <div className="bg-white p-1 rounded border border-gray-200">
                    <p className="text-gray-600 font-semibold">✅:</p>
                    <p className="font-mono text-gray-800 break-words">{sub.ground_truth_value || '(ריק)'}</p>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="bg-white rounded border border-gray-200 shadow-sm">
      {/* Summary Section - Compact */}
      <div className="p-3 border-b bg-gradient-to-r from-gray-50 to-blue-50 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-base text-gray-800">{vendorName}</h3>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">
            {result.total_score.toFixed(1)}
          </p>
          <p className="text-xs text-gray-600">סה"כ</p>
        </div>
      </div>

      {/* Score Breakdown - Compact */}
      <div className="p-3 border-b">
        {/* Score Summary Cards - Smaller */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-blue-50 p-2 rounded border border-blue-200 text-center text-sm">
            <p className="text-xs text-gray-600">🎯 דיוק</p>
            <p className="font-bold text-blue-600">
              {result.overall_accuracy.toFixed(1)}
            </p>
          </div>
          <div className="bg-green-50 p-2 rounded border border-green-200 text-center text-sm">
            <p className="text-xs text-gray-600">⏱️ זמן</p>
            <p className="font-bold text-green-600">
              {result.overall_time_score.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Document Type Details - Compact */}
        <div className="space-y-1 text-sm">
          {renderDocTypeBreakdown()}
        </div>
      </div>

      {/* Show More Button */}
      <button
        onClick={fetchSubmissionHistory}
        disabled={loading}
        className={`w-full p-2 flex items-center justify-center gap-1 text-sm font-semibold transition-colors ${
          expanded
            ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            : 'bg-white text-blue-600 hover:bg-blue-50'
        } border-t`}
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent"></div>
            <span>טוען...</span>
          </>
        ) : expanded ? (
          <>
            <ChevronUp size={16} />
            <span>הסתר פרטים</span>
          </>
        ) : (
          <>
            <ChevronDown size={16} />
            <span>📋 הראה פרטים</span>
          </>
        )}
      </button>

      {/* Expanded Details */}
      {expanded && submissionHistory && (
        <div className="p-3 bg-gray-50 border-t text-sm">
          <h4 className="font-bold text-gray-800 mb-3">📋 הנתונים בפרוט</h4>
          {renderSubmissionDetails()}
        </div>
      )}
    </div>
  );
};

export default ScoreBreakdown;
