const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const documentService = require('./../services/document_service');
const cloudinaryService = require('./../services/cloudinary_service');

//Upload file lên cloudinary và tạo trong cdl - Cần tối ưu thêm + Xóa phần mở rộng khỏi tên tệp
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

  if (!results || results.length === 0) {
    return next(new AppError('Không tìm thấy tài liệu phù hợp', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Tìm kiếm tài liệu thành công',
    data: {
      documents: results,
    },
  });
});

exports.downloadFile = catchAsync(async (req, res, next) => {
  const documentId = Number(req.params.id);

  if (!documentId || isNaN(documentId)) {
    return next(new AppError('Document ID không hợp lệ', 400));
  }

  // Lấy thông tin document
  const document = await documentService.getDocumentByID(documentId);

  if (!document) {
    return next(new AppError('Không tìm thấy tài liệu', 404));
  }
  // Stream file từ Cloudinary về client với tên file đúng
  const https = require('https');
  const http = require('http');

  // Lấy secure URL từ Cloudinary (đảm bảo có quyền truy cập)
  const secureUrl = cloudinaryService.getSecureDownloadUrl(document.file_url);
  const fileUrl = secureUrl || document.file_url;
  const fileName = document.title;

  console.log(`[DOWNLOAD] Document ID: ${documentId}`);
  console.log(`[DOWNLOAD] Original URL: ${document.file_url}`);
  console.log(`[DOWNLOAD] Secure URL: ${fileUrl}`);
  console.log(`[DOWNLOAD] File Type: ${document.file_type}`);
  console.log(`[DOWNLOAD] File Name: ${fileName}`);

  // Xác định extension từ file_type hoặc URL
  let extension = '';
  if (document.file_type) {
    const mimeToExt = {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        '.pptx',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'text/plain': '.txt',
    };
    extension = mimeToExt[document.file_type] || '';
  }

  // Nếu fileName chưa có extension thì thêm vào
  const finalFileName = fileName.includes('.')
    ? fileName
    : fileName + extension;

  // Stream file từ Cloudinary
  const protocol = fileUrl.startsWith('https') ? https : http;

  const request = protocol.get(fileUrl, (cloudinaryResponse) => {
    console.log(
      `[DOWNLOAD] Cloudinary response status: ${cloudinaryResponse.statusCode}`
    );
    console.log(`[DOWNLOAD] Cloudinary headers:`, cloudinaryResponse.headers);

    // Kiểm tra status code từ Cloudinary
    if (cloudinaryResponse.statusCode !== 200) {
      console.error(
        `[DOWNLOAD ERROR] Cloudinary returned status ${cloudinaryResponse.statusCode} for ${fileUrl}`
      );

      // Đọc error message từ Cloudinary nếu có
      let errorBody = '';
      cloudinaryResponse.on('data', (chunk) => {
        errorBody += chunk.toString();
      });
      cloudinaryResponse.on('end', () => {
        console.error(`[DOWNLOAD ERROR] Cloudinary error body: ${errorBody}`);
      });

      return next(
        new AppError(
          `Không thể tải xuống tài liệu từ Cloudinary (HTTP ${cloudinaryResponse.statusCode})`,
          500
        )
      );
    }

    // Set headers SAU KHI xác nhận file tồn tại
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(finalFileName)}"`
    );

    // Ưu tiên Content-Type từ Cloudinary, fallback về database
    const contentType =
      cloudinaryResponse.headers['content-type'] ||
      document.file_type ||
      'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // Set Content-Length nếu có
    if (cloudinaryResponse.headers['content-length']) {
      res.setHeader(
        'Content-Length',
        cloudinaryResponse.headers['content-length']
      );
      console.log(
        `[DOWNLOAD] File size: ${cloudinaryResponse.headers['content-length']} bytes`
      );
    }

    // Pipe stream từ Cloudinary tới response
    cloudinaryResponse.pipe(res);

    // Handle lỗi từ stream
    cloudinaryResponse.on('error', (error) => {
      console.error(
        '[DOWNLOAD ERROR] Error streaming file from Cloudinary:',
        error
      );
      if (!res.headersSent) {
        return next(new AppError('Lỗi khi tải xuống tài liệu', 500));
      }
    });

    // Handle khi stream kết thúc
    cloudinaryResponse.on('end', () => {
      console.log(`[DOWNLOAD] Stream completed for document ${documentId}`);
    });

    // Handle lỗi khi ghi vào response
    res.on('error', (error) => {
      console.error('[DOWNLOAD ERROR] Error writing to response:', error);
      cloudinaryResponse.destroy();
    });
  });

  // Handle lỗi khi request tới Cloudinary
  request.on('error', (error) => {
    console.error(
      '[DOWNLOAD ERROR] Error requesting file from Cloudinary:',
      error
    );
    if (!res.headersSent) {
      return next(new AppError('Không thể kết nối tới Cloudinary', 500));
    }
  });

  // Set timeout cho request
  request.setTimeout(30000, () => {
    console.error('[DOWNLOAD ERROR] Request timeout');
    request.destroy();
    if (!res.headersSent) {
      return next(new AppError('Timeout khi tải xuống tài liệu', 504));
    }
  });
});

// Lấy danh sách môn học tự nhiên (Natural)
exports.getNaturalSubjectDocuments = catchAsync(async (req, res, next) => {
  const documents = await documentService.getDocumentsBySubjectType('Natural');

  res.status(200).json({
    status: 'success',
    message: 'Lấy danh sách tài liệu môn học tự nhiên thành công',
    results: documents.length,
    data: {
      documents,
    },
  });
});

// Lấy danh sách môn học xã hội (Social)
exports.getSocialSubjectDocuments = catchAsync(async (req, res, next) => {
  const documents = await documentService.getDocumentsBySubjectType('Social');

  res.status(200).json({
    status: 'success',
    message: 'Lấy danh sách tài liệu môn học xã hội thành công',
    results: documents.length,
    data: {
      documents,
    },
  });
});

// Lấy danh sách các bài top rating
exports.getTopRatedDocuments = catchAsync(async (req, res, next) => {
  const limit = parseInt(req.query.limit) || 10;

  if (limit < 1 || limit > 100) {
    return next(new AppError('Limit phải từ 1 đến 100', 400));
  }

  const documents = await documentService.getTopRatedDocuments(limit);

  res.status(200).json({
    status: 'success',
    message: 'Lấy danh sách tài liệu top rating thành công',
    results: documents.length,
    data: {
      documents,
    },
  });
});
