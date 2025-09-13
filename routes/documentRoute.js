const express = require('express');
const documentController = require('./../controllers/documentController');
const authController = require('./../controllers/authController');
const { upload } = require('../services/cloudinary_service');

const router = express.Router();

// Route upload file đầy đủ (upload + tạo record trong DB)
router
  .route('/')
  .post(
    authController.protect,
    upload.single('file'),
    documentController.uploadFile
  )
  .get(documentController.getAllFile);

router.get('/my-documents', documentController.getMyFile);

router
  .route('/:id')
  .get(documentController.getFileDetails)
  .patch(documentController.updateFileDetails)
  .delete(documentController.deleteFileDetails);

router
  .route('/:id/comments')
  .get(documentController.getAllComments)
  .post(documentController.addComment);

router.post('/:id/ratings', documentController.addRating);

module.exports = router;
