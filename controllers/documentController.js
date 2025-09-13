const prisma = require('../utils/db');
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

  try {
    // Bước 1: Lấy thông tin file đã upload lên Cloudinary
    const uploadResult = {
      fileUrl: req.file.path,
      fileType: req.file.mimetype,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      publicId: req.file.filename,
    };
    console.log(uploadResult);
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
  } catch (err) {
    console.error('Error saving document:', err);
    return next(new AppError('Lỗi khi lưu thông tin file vào database', 500));
  }
});

//Lấy toàn bộ file cần được duyệt
exports.getAllFile = () => {};

exports.getMyFile = () => {};

exports.getFileDetails = () => {};

exports.updateFileDetails = () => {};

exports.deleteFileDetails = () => {};

exports.getAllComments = () => {};

exports.addComment = () => {};

exports.addRating = () => {};
