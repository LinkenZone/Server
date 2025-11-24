const prisma = require('../utils/db');

// Lấy danh sách bình luận theo document_id
async function getCommentsByDocumentId(documentId) {
  return await prisma.comment.findMany({
    where: { document_id: documentId },
    include: {
      user: {
        select: {
          user_id: true,
          full_name: true,
          email: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });
}

// Thêm bình luận
async function addComment(documentId, userId, content) {
  return await prisma.comment.create({
    data: {
      document_id: documentId,
      user_id: userId,
      content: content,
      created_at: new Date(),
    },
    include: {
      user: {
        select: {
          user_id: true,
          full_name: true,
          email: true,
        },
      },
    },
  });
}

//Cập nhật bình luận
async function updateComment(documentId, commentId, content) {
  const comment = await prisma.comment.findUnique({
    where: { comment_id: commentId },
  });

  if (!comment || comment.document_id !== documentId)
    throw new Error(
      'Không tìm thấy bình luận hoặc bình luận không thuộc tài liệu này'
    );

  return await prisma.comment.update({
    where: { comment_id: commentId },
    data: {
      content,
    },
  });
}

// Xoá bình luận
async function deleteComment(documentId, commentId) {
  const comment = await prisma.comment.findUnique({
    where: { comment_id: commentId },
  });

  if (!comment || comment.document_id !== documentId)
    throw new Error(
      'Không tìm thấy bình luận hoặc bình luận không thuộc tài liệu này'
    );

  return await prisma.comment.delete({
    where: { comment_id: commentId },
  });
}

module.exports = {
  addComment,
  updateComment,
  deleteComment,
  getCommentsByDocumentId,
};
