const express = require('express');
const router = express.Router();
const groundTruthController = require('../controllers/groundTruthController');

router.post('/upload', groundTruthController.uploadGroundTruth);
router.get('/available', groundTruthController.getAvailableDocumentTypes);
// SECURITY: Disabled full GT access via API - use scripts directly to manage GT data
router.get('/', groundTruthController.getGroundTruth);
router.delete('/', groundTruthController.deleteGroundTruth);

module.exports = router;
