const mongoose = require('mongoose');

const groundTruthSchema = new mongoose.Schema({
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
  expected_value: {
    type: String,
    required: true,
    default: 'NULL'
  }
}, {
  timestamps: true
});

groundTruthSchema.index({ file_name: 1, document_type: 1, field_name: 1 }, { unique: true });

const GroundTruth = mongoose.model('groundtruths', groundTruthSchema, 'groundtruths');

module.exports = GroundTruth;
