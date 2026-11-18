const express = require('express');
const router = express.Router();
const multer = require('multer');
const vendorController = require('../controllers/vendorController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/upload', vendorController.uploadVendorSubmission);
router.post('/upload-zip', upload.single('zipFile'), vendorController.uploadVendorZip);
router.get('/submissions', vendorController.getVendorSubmissions);
router.get('/:vendor_name/submission-history', vendorController.getVendorSubmissionHistory);
router.get('/intermediate-tables', vendorController.getIntermediateTables);
router.post('/calculate-final', vendorController.calculateFinalScores);
router.get('/results', vendorController.getEvaluationResults);
router.put('/subjective-score', vendorController.updateSubjectiveScore);
router.delete('/all', vendorController.deleteAllVendorData);

module.exports = router;
