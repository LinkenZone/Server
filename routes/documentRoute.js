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

// Lấy tất cả tài liệu đã duyệt
router.get('/approved-documents', documentController.getApprovedFiles);

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

// Get starred documents
router.get(
  '/starred',
  authController.protect,
  documentController.getStarredFiles
);

// Get recent documents
router.get(
  '/recent',
  authController.protect,
  documentController.getRecentFiles
);

// Get shared documents
router.get(
  '/shared',
  authController.protect,
  documentController.getSharedFiles
);

// Get storage statistics
router.get(
  '/storage-stats',
  authController.protect,
  documentController.getStorageStats
);

// Download file - Lấy URL từ Cloudinary
router.get('/:id/download', documentController.downloadFile);

// Toggle star
router.patch(
  '/:id/star',
  authController.protect,
  documentController.toggleStar
);

// Share document
router.post(
  '/:id/share',
  authController.protect,
  documentController.shareDocument
);

router
  .route('/:id')
  .get(documentController.getFileDetails)
  .patch(authController.protect, documentController.updateFile)
  .delete(authController.protect, documentController.deleteFile);

// Track access (middleware) - chỉ cho các route cần authentication
router.use('/:id/star', authController.protect, documentController.trackAccess);
router.use(
  '/:id/share',
  authController.protect,
  documentController.trackAccess
);

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

// Quản lý tags của document (admin only)
router.get('/:id/tags', documentController.getDocumentTags);
router.put(
  '/:id/tags',
  authController.protect,
  documentController.updateDocumentTags
);

module.exports = router;
