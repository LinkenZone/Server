const prisma = require('../utils/db');

// Tạo 1 dữ liệu trong bảng document
async function createDocumentRecord(uploadResult, documentData, userId) {
  const { title, description, subject_id, lecturer_id } = documentData;
  // Tạo document mới trong database
  return prisma.document.create({
    data: {
      title,
      description,
      file_url: uploadResult.fileUrl,
      file_type: uploadResult.fileType,
      uploader_id: userId,
      subject_id: subject_id ? parseInt(subject_id) : null,
      lecturer_id: lecturer_id ? parseInt(lecturer_id) : null,
      status: 'pending', // Mặc định là pending, cần admin approve
    },
    include: {
      uploader: {
        select: {
          user_id: true,
          full_name: true,
          email: true,
        },
      },
    },
  });
}

// Lấy toàn bộ dữ liệu của người dùng
async function getAllUserDocument(user_id, is_deleted) {
  const documents = await prisma.document.findMany({
    where: { uploader_id: user_id, is_deleted },
    select: {
      document_id: true,
      title: true,
      description: true,
      file_url: true,
      file_type: true,
    },
    orderBy: { uploaded_at: 'desc' },
  });

  // Gọi 2 hàm con cho từng document
  return Promise.all(
    documents.map(async (doc) => {
      const avgRating = await getAverageRating(doc.document_id);
      const commentCount = await getCommentCount(doc.document_id);
      return { ...doc, avgRating, commentCount };
    })
  );
}

//Tính số rating trung bình của một tài liệu
async function getAverageRating(documentId) {
  const result = await prisma.rating.aggregate({
    where: { document_id: documentId },
    _avg: { score: true },
  });
  return result._avg.score ?? null; // nếu chưa có rating nào thì trả về null
}

// Tính số comment
async function getCommentCount(documentId) {
  return prisma.comment.count({
    where: { document_id: documentId },
  });
}

// Lấy tài liệu theo document cần thiết
// Cần bổ sung thêm lấy các bình luận
async function getDocumentByID(id) {
  const doc = prisma.document.findUnique({
    where: { document_id: id },
  });

  doc.ratings = getAverageRating(doc.document_id);
  return doc;
}

// Xóa tài liệu
async function deleteDocument(id) {
  return prisma.document.update({
    where: { document_id: id },
    data: {
      is_deleted: true,
      deleted_at: new Date(),
    },
  });
}

// Khôi phục tài liệu
async function restoredDocument(id) {
  return prisma.document.update({
    where: { document_id: id },
    data: {
      is_deleted: false,
      deleted_at: null,
    },
  });
}

async function updateDocument(id, title, description) {
  return prisma.document.update({
    where: { document_id: id },
    data: {
      title,
      description,
    },
  });
}

module.exports = {
  createDocumentRecord,
  getAllUserDocument,
  getDocumentByID,
  deleteDocument,
  getAverageRating,
  getCommentCount,
  restoredDocument,
  updateDocument,
};
