const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const documentService = require('./../services/document_service');

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

exports.deleteFile = catchAsync(async (req, res, next) => {
  // 1. Kiểm tra file có tồn tại bằng req.param.id
  const doc_id = Number(req.params.id);
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
  const document_id = req.body.document_id;
  console.log('----------------------');
  console.log(document_id);
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
