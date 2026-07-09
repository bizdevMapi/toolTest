const mongoose = require('mongoose');

const documentTypeScoreSchema = new mongoose.Schema({
  document_type: {
    type: String,
    required: true,
    enum: ['permit', 'garmushka', 'tazar', 'mavat']
  },
  median_time: {
    type: Number,
    required: true
  },
  time_score: {
    type: Number,
    required: true
  },
  accuracy_score: {
    type: Number,
    required: true
  }
}, { _id: false });

const evaluationResultSchema = new mongoose.Schema({
  vendor_name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  document_type_scores: [documentTypeScoreSchema],
  overall_accuracy: {
    type: Number,
    required: true
  },
  overall_time_score: {
    type: Number,
    required: true
  },
  subjective_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 20
  },
  automated_score: {
    type: Number,
    required: true
  },
  total_score: {
    type: Number,
    required: true
  },
  rank: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

evaluationResultSchema.index({ total_score: -1 });

const EvaluationResult = mongoose.model('EvaluationResult', evaluationResultSchema);

module.exports = EvaluationResult;
