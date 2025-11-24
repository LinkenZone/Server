const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const documentService = require('./../services/document_service');
const reportService = require('../services/reports_service');

exports.uploadFile = catchAsync(async (req, res, next) => {
  // Kiểm tra xem có file được upload không
  if (!req.file) {
    return next(new AppError('Vui lòng chọn file để upload', 400));
  }

  let { title, description, subject_id, lecturer_id } = req.body;

  //   Kiểm tra các trường bắt buộc
  if (!title || title.trim === '') {
    title = req.file.originalname;
  }

  // Kiểm tra user đã được authenticate
  if (!req.user) {
    return next(new AppError('Bạn cần đăng nhập để upload file', 401));
  }

  // Bước 1: Lấy thông tin file đã upload lên Cloudinary
  const uploadResult = {
    fileUrl: req.file.path,
    fileType: req.file.mimetype,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    publicId: req.file.filename,
  };
  // Bước 2: Tạo document record trong database
  const documentData = { title, description, subject_id, lecturer_id };
  const newDocument = await documentService.createDocumentRecord(
    uploadResult,
    documentData,
    req.user.user_id
  );

  reportService.updateDashboardReport('today_upload');

  res.status(201).json({
    status: 'success',
    message: 'File đã được upload và lưu thông tin thành công',
    data: {
      document: newDocument,
      upload: uploadResult,
    },
  });
});

// Lấy toàn bộ file của người dùng hiện tại
// Chưa xong - Chờ elastic search để tích hợp tìm kiếm, lọc, phân trang
exports.getMyFile = catchAsync(async (req, res, next) => {
  // Kiểm tra user đã được authenticate
  if (!req.user) {
    return next(new AppError('Đăng nhập để thực hiện hành động này', 401));
  }

  const userId = req.user.user_id;

  const documents = await documentService.getAllUserDocument(userId, false);

  res.status(200).json({
    status: 'success',
    message: 'Lấy toàn bộ file của bạn thành công',
    data: {
      documents,
    },
  });
});

exports.getDeletedFile = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Đăng nhập để thực hiện hành động này', 401));
  }

  const userId = req.user.user_id;

  const documents = await documentService.getAllUserDocument(userId, true);

  res.status(200).json({
    status: 'success',
    message: 'Lấy toàn bộ file của bạn thành công',
    data: {
      documents,
    },
  });
});

exports.getAllFiles = catchAsync(async (req, res, next) => {
  // Kiểm tra user có phải admin không
  if (!req.user || req.user.role !== 'admin') {
    return next(
      new AppError(
        'Chỉ admin mới có quyền truy cập tài liệu toàn hệ thống',
        403
      )
    );
  }
  const allDocuments = await documentService.getAllDocuments();
  res.status(200).json({
    status: 'success',
    message: 'Lấy tài liệu toàn hệ thống thành công',
    data: {
      allDocuments,
    },
  });
});

exports.getApprovedFiles = catchAsync(async (req, res, next) => {
  const approvedDocuments = await documentService.getApprovedDocuments();
  res.status(200).json({
    status: 'success',
    message: 'Lấy tài liệu đã duyệt thành công',
    data: {
      documents: approvedDocuments,
    },
  });
});

exports.getFileDetails = catchAsync(async (req, res, next) => {
  // 1. Lấy id trên req.params
  const doc_id = req.params.id;
  // 2. Lấy file cần thiết
  const document = await documentService.getDocumentByID(doc_id);
  if (!document) {
    return next(new AppError('Không tìm thấy tài liệu', 404));
  }
  // 3. Response cho user
  res.status(200).json({
    status: 'success',
    message: 'Lấy chi tiết file thành công',
    data: {
      document,
    },
  });
});

exports.updateFile = catchAsync(async (req, res, next) => {
  if (!req.user)
    return next(new AppError('Cần đăng nhập để thực hiện hành động này', 400));

  const doc_id = Number(req.params.id);
  const { title, description } = req.body;

  const document = await documentService.updateDocument(
    doc_id,
    title,
    description
  );

  res.status(202).json({
    status: 'success',
    message: 'Cập nhật file thành công',
    data: {
      document,
    },
  });
});

// Duyệt file
exports.approveFile = catchAsync(async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Chỉ admin mới có quyền duyệt tài liệu', 403));
  }

  const document_id = Number(req.params.id);
  const document = await documentService.getDocumentByID(document_id);

  if (!document) {
    return next(new AppError('Không tìm thấy file trong hệ thống', 404));
  }

  const approvedDocument = await documentService.approveDocument(document_id);
  res.status(200).json({
    status: 'success',
    message: 'Duyệt file thành công',
    data: {
      approvedDocument,
    },
  });
});

// Từ chối và xóa tài liệu từ chối
exports.rejectFile = catchAsync(async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Chỉ admin mới có quyền từ chối tài liệu', 403));
  }

  const doc_id = Number(req.params.id);
  const doc = await documentService.getDocumentByID(doc_id);

  if (!doc) {
    return next(new AppError('Không tìm thấy tài liệu', 404));
  }

  if (doc.status !== 'pending') {
    return next(
      new AppError('Chỉ có thể từ chối tài liệu đang chờ duyệt', 400)
    );
  }

  const rejectDocument = await documentService.rejectAndDeleteDocument(
    doc_id,
    req.body.rejectionReason
  );
  res.status(200).json({
    status: 'success',
    message: 'Từ chối và xóa tài liệu thành công',
    data: { rejectDocument },
  });
});

exports.deleteFile = catchAsync(async (req, res, next) => {
  // 1. Lấy document_id từ body hoặc params
  const doc_id = Number(req.params.id);

  if (!doc_id || isNaN(doc_id)) {
    return next(new AppError('Document ID không hợp lệ', 400));
  }

  const document = await documentService.getDocumentByID(doc_id);

  if (!document) {
    return next(new AppError('Không tìm thấy file trong hệ thống', 404));
  }

  // 2. Nếu có thì cập nhật db
  await documentService.deleteDocument(doc_id);

  // 3. Gửi request cho client
  res.status(200).json({
    status: 'success',
    message: 'Xóa file thành công',
  });
});

exports.restoreFile = catchAsync(async (req, res, next) => {
  const document_id = Number(req.body.document_id || req.params.id);

  if (!document_id || isNaN(document_id)) {
    return next(new AppError('Document ID không hợp lệ', 400));
  }

  const document = await documentService.getDocumentByID(document_id);

  if (!document) {
    return next(new AppError('Không tìm thấy file trong hệ thống', 404));
  }

  const restoredDocument = await documentService.restoreDocument(document_id);
  res.status(200).json({
    status: 'success',
    message: 'Khôi phục file thành công',
    data: {
      restoredDocument,
    },
  });
});

exports.permanentDeleteFile = catchAsync(async (req, res, next) => {
  const document_id = Number(req.body.document_id || req.params.id);

  if (!document_id || isNaN(document_id)) {
    return next(new AppError('Document ID không hợp lệ', 400));
  }

  const document = await documentService.getDocumentByID(document_id);

  if (!document) {
    return next(new AppError('Không tìm thấy file trong hệ thống', 404));
  }

  await documentService.forceDeleteDocument(document_id);
  res.status(200).json({
    status: 'success',
    message: 'Xóa vĩnh viễn file thành công',
  });
});

exports.searchFiles = catchAsync(async (req, res, next) => {
  const query = req.query.q || '';
  const results = await documentService.searchDocuments(query);

  res.status(200).json({
    status: 'success',
    message: 'Tìm kiếm tài liệu thành công',
    data: {
      documents: results,
    },
  });
});

//Note: URL chuẩn để tải file https://res.cloudinary.com/dbbsalgdq/raw/upload/fl_attachment:${title}/v1762178201/linkenzone_uploads/ersqmdywza5edqbznxbq.pdf
exports.downloadFile = catchAsync(async (req, res, next) => {
  const docId = Number(req.params.id);

  if (!docId || isNaN(docId)) {
    return next(new AppError('Document ID không hợp lệ', 400));
  }

  const document = await documentService.getDocumentByID(docId);

  if (!document) {
    return next(new AppError('Không tìm thấy tài liệu', 404));
  }

  const fileName = document.title.split('.');
  const downloadUrl = document.file_url.replace(
    '/upload/',
    `/upload/fl_attachment:${encodeURIComponent(fileName[0])}/`
  );

  reportService.updateDashboardReport('total_download');

  return res.status(200).json({
    status: 'success',
    message: 'Lấy link tải xuống thành công',
    data: {
      downloadUrl,
      fileName,
    },
  });
});

// Toggle star/unstar document
exports.toggleStar = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Cần đăng nhập để thực hiện hành động này', 401));
  }

  const docId = Number(req.params.id);
  if (!docId || isNaN(docId)) {
    return next(new AppError('Document ID không hợp lệ', 400));
  }

  const document = await documentService.toggleStarDocument(
    docId,
    req.user.user_id
  );

  res.status(200).json({
    status: 'success',
    message: document.is_starred ? 'Đã đánh dấu sao' : 'Đã bỏ đánh dấu sao',
    data: { document },
  });
});

// Get starred documents
exports.getStarredFiles = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Cần đăng nhập để thực hiện hành động này', 401));
  }

  const documents = await documentService.getStarredDocuments(req.user.user_id);

  res.status(200).json({
    status: 'success',
    message: 'Lấy danh sách tài liệu đánh dấu sao thành công',
    data: { documents },
  });
});

// Get recent documents
exports.getRecentFiles = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Cần đăng nhập để thực hiện hành động này', 401));
  }

  const documents = await documentService.getRecentDocuments(req.user.user_id);

  res.status(200).json({
    status: 'success',
    message: 'Lấy danh sách tài liệu gần đây thành công',
    data: { documents },
  });
});

// Get shared documents
exports.getSharedFiles = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Cần đăng nhập để thực hiện hành động này', 401));
  }

  const documents = await documentService.getSharedDocuments(req.user.user_id);

  res.status(200).json({
    status: 'success',
    message: 'Lấy danh sách tài liệu được chia sẻ thành công',
    data: { documents },
  });
});

// Share document with users
exports.shareDocument = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Cần đăng nhập để thực hiện hành động này', 401));
  }

  const docId = Number(req.params.id);
  const { userIds } = req.body;

  if (!docId || isNaN(docId)) {
    return next(new AppError('Document ID không hợp lệ', 400));
  }

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return next(
      new AppError('Vui lòng cung cấp danh sách người dùng để chia sẻ', 400)
    );
  }

  const document = await documentService.shareDocument(
    docId,
    req.user.user_id,
    userIds
  );

  res.status(200).json({
    status: 'success',
    message: 'Chia sẻ tài liệu thành công',
    data: { document },
  });
});

// Update last accessed (middleware này có thể gọi tự động khi view document)
exports.trackAccess = catchAsync(async (req, res, next) => {
  if (req.user) {
    const docId = Number(req.params.id);
    if (docId && !isNaN(docId)) {
      await documentService.updateLastAccessed(docId, req.user.user_id);
    }
  }
  next();
});

// Get user storage statistics
exports.getStorageStats = catchAsync(async (req, res) => {
  const userId = req.user.user_id;
  const stats = await documentService.getUserStorageStats(userId);

  res.status(200).json({
    status: 'success',
    data: {
      storage: stats,
    },
  });
});

// Lấy danh sách tags của document
exports.getDocumentTags = catchAsync(async (req, res, next) => {
  const documentId = Number(req.params.id);

  if (!documentId || isNaN(documentId)) {
    return next(new AppError('Document ID không hợp lệ', 400));
  }

  const tags = await documentService.getDocumentTags(documentId);

  res.status(200).json({
    status: 'success',
    data: { tags },
  });
});

// Cập nhật tags của document (admin only)
exports.updateDocumentTags = catchAsync(async (req, res, next) => {
  // Kiểm tra quyền admin
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Chỉ admin mới có quyền cập nhật tags', 403));
  }

  const documentId = Number(req.params.id);
  const { tagIds, newTags } = req.body;

  if (!documentId || isNaN(documentId)) {
    return next(new AppError('Document ID không hợp lệ', 400));
  }

  // tagIds: array of existing tag IDs
  // newTags: array of new tag objects { tag_name, description, color }
  const result = await documentService.updateDocumentTags(documentId, {
    tagIds: tagIds || [],
    newTags: newTags || [],
  });

  res.status(200).json({
    status: 'success',
    message: 'Cập nhật tags thành công',
    data: result,
  });
});
