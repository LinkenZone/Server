const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const commentService = require('./../services/comment_service');

// Lấy danh sách bình luận
exports.getComments = catchAsync(async (req, res) => {
  const documentId = Number(req.params.id);

  const comments = await commentService.getCommentsByDocumentId(documentId);

  res.status(200).json({
    status: 'success',
    message: 'Lấy danh sách bình luận thành công',
    data: comments,
  });
});

// Thêm bình luận
exports.addComment = catchAsync(async (req, res, next) => {
  const documentId = Number(req.params.id);
  const { content } = req.body;

  if (!req.user) {
    return next(new AppError('Đăng nhập để thực hiện hành động này', 401));
  }

  const comment = await commentService.addComment(
    documentId,
    req.user.user_id,
    content
  );

  res.status(201).json({
    status: 'success',
    message: 'Thêm bình luận thành công',
    data: {
      comment,
    },
  });
});

// Cập nhật bình luận
exports.updateComment = catchAsync(async (req, res, next) => {
  const documentId = Number(req.params.id);
  const commentId = Number(req.params.commentId);
  const { content } = req.body;

  if (!req.user) {
    return next(new AppError('Đăng nhập để thực hiện hành động này', 401));
  }

  const updatedComment = await commentService.updateComment(
    documentId,
    commentId,
    content
  );

  res.status(202).json({
    status: 'success',
    message: 'Cập nhật bình luận thành công',
    data: {
      comment: updatedComment,
    },
  });
});

// Xoá bình luận
exports.deleteComment = catchAsync(async (req, res, next) => {
  const documentId = Number(req.params.id);
  const commentId = Number(req.params.commentId);

  if (!req.user) {
    return next(new AppError('Đăng nhập để thực hiện hành động này', 401));
  }

  await commentService.deleteComment(documentId, commentId);

  res.status(200).json({
    status: 'success',
    message: 'Xoá bình luận thành công',
  });
});
