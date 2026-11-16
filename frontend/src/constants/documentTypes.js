/**
 * Shared document type configuration
 * Used across multiple components to maintain consistency
 */
export const documentTypeConfig = {
  permit: { title: 'היתר בנייה מילולי', color: 'blue', weight: 5 },
  garmushka: { title: 'גרמושקה', color: 'green', weight: 5 },
  tazar: { title: 'תצ"ר', color: 'purple', weight: 20 },
  mavat: { title: 'מבא"ת', color: 'orange', weight: 20 }
};

/**
 * Color utilities for table rendering
 */
export const getColorClasses = (color) => {
  const colorMap = {
    blue: 'border-blue-300 bg-blue-50',
    green: 'border-green-300 bg-green-50',
    purple: 'border-purple-300 bg-purple-50',
    orange: 'border-orange-300 bg-orange-50'
  };
  return colorMap[color] || 'border-blue-300 bg-blue-50';
};

export const getHeaderClasses = (color) => {
  const colorMap = {
    blue: 'bg-blue-200',
    green: 'bg-green-200',
    purple: 'bg-purple-200',
    orange: 'bg-orange-200'
  };
  return colorMap[color] || 'bg-blue-200';
};

/**
 * Get accuracy color class based on score threshold
 * @param {number} accuracyScore - Accuracy percentage (0-100)
 * @returns {string} Tailwind CSS classes for text color
 */
export const getAccuracyColorClass = (accuracyScore) => {
  return accuracyScore >= 80 ? 'text-green-700 font-bold' : 'text-gray-500';
};
