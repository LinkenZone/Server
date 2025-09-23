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
  );

// Route lấy documents của user hiện tại (cần authentication)
router.get(
  '/my-documents',
  authController.protect,
  documentController.getMyFile
);

router.get(
  '/my-deleted-documents',
  authController.protect,
  documentController.getDeletedFile
);

// Khôi phục file
router.patch(
  '/restore',
  authController.protect,
  documentController.restoreFile
);

router
  .route('/:id')
  .get(documentController.getFileDetails)
  .patch(authController.protect, documentController.updateFile)
  .delete(authController.protect, documentController.deleteFile);

module.exports = router;
