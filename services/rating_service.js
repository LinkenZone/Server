const prisma = require('../utils/db');

// Lấy danh sách đánh giá theo document_id
async function getRatingsByDocumentId(documentId) {
  return await prisma.rating.findMany({
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
      rated_at: 'desc',
    },
  });
}

// Thêm đánh giá
async function addRating(documentId, userId, score) {
  return await prisma.rating.create({
    data: {
      document_id: documentId,
      user_id: userId,
      score: score,
      rated_at: new Date(),
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

// Cập nhật đánh giá
async function updateRating(documentId, ratingId, score) {
  const rating = await prisma.rating.findUnique({
    where: { rating_id: ratingId },
  });
  if (!rating || rating.document_id !== documentId) {
    throw new Error('Không tìm thấy đánh giá');
  }

  return await prisma.rating.update({
    where: { rating_id: ratingId },
    data: { score },
  });
}

module.exports = {
  addRating,
  updateRating,
  getRatingsByDocumentId,
};
