const express = require('express');
const tagController = require('../controllers/tagController');
const { protect } = require('../controllers/authController');

const router = express.Router();

// Public routes
router.get('/', tagController.getAllTags);
router.get('/:id', tagController.getTagById);
router.get('/:id/documents', tagController.getDocumentsByTag);

// Protected routes (admin only)
router.use(protect); // Require authentication for routes below

router.post('/', tagController.createTag);
router.patch('/:id', tagController.updateTag);
router.delete('/:id', tagController.deleteTag);
router.post('/document/:documentId', tagController.assignTagsToDocument);

module.exports = router;
