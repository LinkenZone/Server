const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const ratingService = require('../services/rating_service');

// Lấy danh sách đánh giá
exports.getRatings = catchAsync(async (req, res) => {
  const documentId = Number(req.params.id);

  const ratings = await ratingService.getRatingsByDocumentId(documentId);

  res.status(200).json({
    status: 'success',
    message: 'Lấy danh sách đánh giá thành công',
    data: ratings,
  });
});

// Thêm đánh giá
exports.addRating = catchAsync(async (req, res, next) => {
  const documentId = Number(req.params.id);
  const { score } = req.body;

  if (!req.user) {
    return next(new AppError('Đăng nhập để thực hiện hành động này', 401));
  }

  const rating = await ratingService.addRating(
    documentId,
    req.user.user_id,
    score
  );

  res.status(201).json({
    status: 'success',
    message: 'Thêm đánh giá thành công',
    data: {
      rating: rating,
    },
  });
});

// Cập nhật đánh giá
exports.updateRating = catchAsync(async (req, res, next) => {
  const documentId = Number(req.params.id);
  const ratingId = Number(req.params.ratingId);
  const { score } = req.body;

  if (!req.user) {
    return next(new AppError('Đăng nhập để thực hiện hành động này', 401));
  }

  const rating = await ratingService.updateRating(documentId, ratingId, score);

  res.status(202).json({
    status: 'success',
    message: 'Cập nhật đánh giá thành công',
    data: {
      rating: rating,
    },
  });
});
