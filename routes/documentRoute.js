const express = require('express');
const documentController = require('./../controllers/documentController');
const authController = require('./../controllers/authController');
const { upload } = require('../services/cloudinary_service');
const commentRoute = require('./commentRoute');
const ratingRoute = require('./ratingRoute');

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

// Lấy tất cả tài liệu
router.get(
  '/all-documents',
  authController.protect,
  documentController.getAllFiles
);

// Khôi phục file
router.patch(
  '/restore',
  authController.protect,
  documentController.restoreFile
);

// Xóa vĩnh viễn file
router.delete(
  '/permanent',
  authController.protect,
  documentController.permanentDeleteFile
);

// Tìm kiếm tài liệu
router.get('/search', documentController.searchFiles);

// Download file
router.get('/:id/download', documentController.downloadFile);

router
  .route('/:id')
  .get(documentController.getFileDetails)
  .patch(authController.protect, documentController.updateFile)
  .delete(authController.protect, documentController.deleteFile);
// Duyệt file
router.patch(
  '/:id/approve',
  authController.protect,
  documentController.approveFile
);
//Từ chối và xóa tài liệu
router.patch(
  '/:id/reject',
  authController.protect,
  documentController.rejectFile
);
// Gắn route bình luận vào document
router.use('/:id/comment', commentRoute);
// Gắn route đánh giá vào document
router.use('/:id/rating', ratingRoute);

module.exports = router;
