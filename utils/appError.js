class AppError extends Error {
  constructor(message, statusCode) {
    super(message); // Gọi constructor của lớp Error với message
    this.statusCode = statusCode;
    // Xác định trạng thái dựa trên mã trạng thái (4xx: fail, 5xx: error)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Đánh dấu lỗi là lỗi vận hành

    // Ghi lại dấu vết ngăn xếp, loại bỏ constructor của AppError
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
