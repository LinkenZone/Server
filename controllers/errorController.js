const AppError = require('../utils/appError');

const handleCastErrorDB = (err) => {
  const message = `Giá trị không hợp lệ cho ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.keyValue ? JSON.stringify(err.keyValue) : 'unknown';
  const message = `Giá trị trùng lặp: ${value}. Vui lòng sử dụng giá trị khác.`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Dữ liệu đầu vào không hợp lệ: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJsonWebTokenError = () => new AppError('Invalid token!!!', 401);

const handleTokenExpiredError = () => new AppError('Token has expired!!!', 401);

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // Lỗi vận hành: gửi thông điệp chi tiết cho client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Lỗi không xác định: ghi log và gửi thông điệp chung chung
    console.error('🚨 LỖI:', err);
    res.status(500).json({
      status: 'error',
      message: 'Có lỗi xảy ra!',
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };

    if (err.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJsonWebTokenError();
    if (error.name === 'TokenExpiredError') error = handleTokenExpiredError();
    sendErrorProd(error, res);
  }
};
