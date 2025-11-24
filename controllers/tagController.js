const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const tagService = require('../services/tag_service');

// Lấy tất cả tags
exports.getAllTags = catchAsync(async (req, res) => {
  const tags = await tagService.getAllTags();

  res.status(200).json({
    status: 'success',
    message: 'Lấy danh sách tags thành công',
    data: { tags },
  });
});

// Lấy tag theo ID
exports.getTagById = catchAsync(async (req, res, next) => {
  const tagId = Number(req.params.id);

  if (!tagId || isNaN(tagId)) {
    return next(new AppError('Tag ID không hợp lệ', 400));
  }

  const tag = await tagService.getTagById(tagId);

  res.status(200).json({
    status: 'success',
    message: 'Lấy thông tin tag thành công',
    data: { tag },
  });
});

// Tạo tag mới (admin only)
exports.createTag = catchAsync(async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Chỉ admin mới có quyền tạo tag', 403));
  }

  const { tag_name, description, color } = req.body;

  if (!tag_name || tag_name.trim() === '') {
    return next(new AppError('Tên tag là bắt buộc', 400));
  }

  const tag = await tagService.createTag({ tag_name, description, color });

  res.status(201).json({
    status: 'success',
    message: 'Tạo tag thành công',
    data: { tag },
  });
});

// Cập nhật tag (admin only)
exports.updateTag = catchAsync(async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Chỉ admin mới có quyền cập nhật tag', 403));
  }

  const tagId = Number(req.params.id);

  if (!tagId || isNaN(tagId)) {
    return next(new AppError('Tag ID không hợp lệ', 400));
  }

  const { tag_name, description, color } = req.body;

  const tag = await tagService.updateTag(tagId, {
    tag_name,
    description,
    color,
  });

  res.status(200).json({
    status: 'success',
    message: 'Cập nhật tag thành công',
    data: { tag },
  });
});

// Xóa tag (admin only)
exports.deleteTag = catchAsync(async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Chỉ admin mới có quyền xóa tag', 403));
  }

  const tagId = Number(req.params.id);

  if (!tagId || isNaN(tagId)) {
    return next(new AppError('Tag ID không hợp lệ', 400));
  }

  const result = await tagService.deleteTag(tagId);

  res.status(200).json({
    status: 'success',
    message: result.message,
  });
});

// Lấy documents theo tag
exports.getDocumentsByTag = catchAsync(async (req, res, next) => {
  const tagId = Number(req.params.id);

  if (!tagId || isNaN(tagId)) {
    return next(new AppError('Tag ID không hợp lệ', 400));
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const result = await tagService.getDocumentsByTag(tagId, {
    skip,
    take: limit,
  });

  res.status(200).json({
    status: 'success',
    message: 'Lấy danh sách documents theo tag thành công',
    data: result,
  });
});

// Gán tags cho document (admin only)
exports.assignTagsToDocument = catchAsync(async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Chỉ admin mới có quyền gán tags', 403));
  }

  const documentId = Number(req.params.documentId);
  const { tagIds } = req.body;

  if (!documentId || isNaN(documentId)) {
    return next(new AppError('Document ID không hợp lệ', 400));
  }

  if (!Array.isArray(tagIds)) {
    return next(new AppError('tagIds phải là mảng', 400));
  }

  const result = await tagService.assignTagsToDocument(documentId, tagIds);

  res.status(200).json({
    status: 'success',
    message: result.message,
  });
});
