const mongoose = require('mongoose');

const vendorSubmissionSchema = new mongoose.Schema({
  vendor_name: {
    type: String,
    required: true,
    trim: true
  },
  file_name: {
    type: String,
    required: true,
    trim: true
  },
  document_type: {
    type: String,
    required: true,
    enum: ['permit', 'garmushka', 'tazar', 'mavat'],
    trim: true
  },
  field_name: {
    type: String,
    required: true,
    trim: true
  },
  extracted_value: {
    type: String,
    required: true,
    default: 'NULL'
  },
  normalized_value: {
    type: String,
    required: true,
    default: 'NULL'
  },
  accuracy_score: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  total_time_seconds: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

vendorSubmissionSchema.index({ vendor_name: 1, document_type: 1 });
vendorSubmissionSchema.index({ vendor_name: 1, file_name: 1, field_name: 1 });

const VendorSubmission = mongoose.model('VendorSubmission', vendorSubmissionSchema);

module.exports = VendorSubmission;
