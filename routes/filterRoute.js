const express = require('express');
const filterController = require('../controllers/filterController');

const router = express.Router();

/**
 * Public routes - Không cần đăng nhập
 */

// GET /api/filter/documents - Lọc tài liệu theo tags và các tiêu chí khác
router.get('/documents', filterController.filterDocuments);

// GET /api/filter/search - Tìm kiếm với Elasticsearch + lọc theo tags
router.get('/search', filterController.searchWithTags);

// GET /api/filter/tags - Lấy danh sách tất cả tags
router.get('/tags', filterController.getAllTags);

// GET /api/filter/tags/statistics - Lấy thống kê tags
router.get('/tags/statistics', filterController.getTagStatistics);

// GET /api/filter/tags/popular - Lấy tags phổ biến
router.get('/tags/popular', filterController.getPopularTags);

/**
 * Protected routes - Cần đăng nhập (nếu cần thêm trong tương lai)
 */

// Ví dụ: GET /api/filter/my-tagged-documents - Lấy documents của user có tags cụ thể
// router.get(
//   '/my-tagged-documents',
//   authController.protect,
//   filterController.getMyDocumentsByTags
// );

module.exports = router;
