const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const filterService = require('../services/filter_service');

/**
 * Lọc tài liệu theo tags và các tiêu chí khác
 * Query params:
 * - tagIds: array of tag IDs (ví dụ: tagIds=1,2,3)
 * - q: search query (tìm kiếm text)
 * - status: document status (pending, approved, rejected)
 * - subjectId: filter by subject
 * - lecturerId: filter by lecturer
 * - uploaderId: filter by uploader
 * - page: page number
 * - limit: items per page
 * - sortBy: field to sort by (uploaded_at, title, avgRating)
 * - sortOrder: asc or desc
 */
exports.filterDocuments = catchAsync(async (req, res) => {
  const {
    tagIds,
    q,
    status,
    subjectId,
    lecturerId,
    uploaderId,
    page = 1,
    limit = 10,
    sortBy = 'uploaded_at',
    sortOrder = 'desc',
  } = req.query;

  // Parse tagIds từ string thành array
  const parsedTagIds = tagIds
    ? tagIds
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id))
    : [];

  const filters = {
    tagIds: parsedTagIds,
    searchQuery: q,
    status,
    subjectId: subjectId ? parseInt(subjectId) : undefined,
    lecturerId: lecturerId ? parseInt(lecturerId) : undefined,
    uploaderId: uploaderId ? parseInt(uploaderId) : undefined,
    page: parseInt(page),
    limit: parseInt(limit),
    sortBy,
    sortOrder,
  };

  const results = await filterService.filterDocuments(filters);

  res.status(200).json({
    status: 'success',
    message: 'Lọc tài liệu thành công',
    data: {
      page: filters.page,
      pageSize: filters.limit,
      total: results.total,
      totalPages: Math.ceil(results.total / filters.limit),
      documents: results.documents,
      appliedFilters: {
        tagIds: parsedTagIds,
        searchQuery: q || null,
        status: status || null,
        subjectId: filters.subjectId || null,
        lecturerId: filters.lecturerId || null,
        uploaderId: filters.uploaderId || null,
      },
    },
  });
});

/**
 * Tìm kiếm tài liệu với Elasticsearch + lọc theo tags
 * Query params giống filterDocuments nhưng ưu tiên sử dụng Elasticsearch
 */
exports.searchWithTags = catchAsync(async (req, res, next) => {
  const {
    tagIds,
    q,
    status,
    subjectId,
    lecturerId,
    page = 1,
    limit = 10,
  } = req.query;

  if (!q || q.trim() === '') {
    return next(
      new AppError('Vui lòng cung cấp từ khóa tìm kiếm (query param "q")', 400)
    );
  }

  // Parse tagIds
  const parsedTagIds = tagIds
    ? tagIds
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id))
    : [];

  const filters = {
    tagIds: parsedTagIds,
    searchQuery: q,
    status,
    subjectId: subjectId ? parseInt(subjectId) : undefined,
    lecturerId: lecturerId ? parseInt(lecturerId) : undefined,
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const results = await filterService.searchDocumentsWithTags(filters);

  res.status(200).json({
    status: 'success',
    message: 'Tìm kiếm tài liệu thành công',
    data: {
      page: filters.page,
      pageSize: filters.limit,
      total: results.total,
      totalPages: Math.ceil(results.total / filters.limit),
      documents: results.documents,
      searchQuery: q,
      appliedFilters: {
        tagIds: parsedTagIds,
        status: status || null,
        subjectId: filters.subjectId || null,
        lecturerId: filters.lecturerId || null,
      },
    },
  });
});

/**
 * Lấy danh sách tất cả tags có sẵn (để hiển thị filter options)
 */
exports.getAllTags = catchAsync(async (req, res) => {
  const tags = await filterService.getAllTags();

  res.status(200).json({
    status: 'success',
    message: 'Lấy danh sách tags thành công',
    data: {
      tags,
    },
  });
});

/**
 * Lấy thống kê số lượng documents theo từng tag
 */
exports.getTagStatistics = catchAsync(async (req, res) => {
  const statistics = await filterService.getTagStatistics();

  res.status(200).json({
    status: 'success',
    message: 'Lấy thống kê tags thành công',
    data: {
      statistics,
    },
  });
});

/**
 * Lấy các tags phổ biến nhất (top N tags có nhiều documents nhất)
 */
exports.getPopularTags = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;

  const popularTags = await filterService.getPopularTags(parseInt(limit));

  res.status(200).json({
    status: 'success',
    message: 'Lấy tags phổ biến thành công',
    data: {
      popularTags,
    },
  });
});
