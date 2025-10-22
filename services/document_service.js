const { get } = require('../routes/commentRoute');
const prisma = require('../utils/db');
const {
  indexDocument,
  updateES,
  deleteES,
  search,
} = require('../utils/elastic');

// Tạo 1 dữ liệu trong bảng document
async function createDocumentRecord(uploadResult, documentData, userId) {
  const { title, description, subject_id, lecturer_id } = documentData;
  // Tạo document mới trong database
  const newDoc = await prisma.document.create({
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
  // Kết hợp thông tin upload vào document mới tạo
  const newDocWithUpload = {
    ...newDoc,
    upload: {
      fileUrl: uploadResult.fileUrl,
      fileType: uploadResult.fileType,
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
      publicId: uploadResult.publicId,
    },
  };
  // Gửi dữ liệu document mới lên Elasticsearch để lập chỉ mục
  try {
    await indexDocument(newDocWithUpload);
  } catch (err) {
    console.error('Elasticsearch indexing failed for new document:', err);
  }
  return newDocWithUpload;
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

// Lấy tất cả tài liệu
async function getAllDocuments() {
  return prisma.document.findMany({
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

// Lấy tài liệu theo document cần thiết
// Cần bổ sung thêm lấy các bình luận
async function getDocumentByID(id) {
  // Chuyển đổi id thành số nguyên
  const documentId = parseInt(id);

  if (isNaN(documentId)) {
    throw new Error('Document ID phải là một số hợp lệ');
  }

  // Lấy document với await
  const doc = await prisma.document.findUnique({
    where: { document_id: documentId },
    include: {
      uploader: {
        select: {
          user_id: true,
          full_name: true,
          email: true,
        },
      },
      subject: {
        select: {
          subject_id: true,
          subject_name: true,
          subject_code: true,
        },
      },
      lecturer: {
        select: {
          lecturer_id: true,
          lecturer_name: true,
        },
      },
    },
  });

  if (!doc) {
    return null;
  }

  // Lấy thông tin bổ sung
  const avgRating = await getAverageRating(doc.document_id);
  const commentCount = await getCommentCount(doc.document_id);

  return {
    ...doc,
    avgRating,
    commentCount,
  };
}

// Xóa tài liệu
async function deleteDocument(id) {
  const documentId = parseInt(id);

  if (isNaN(documentId)) {
    throw new Error('Document ID phải là một số hợp lệ');
  }

  const deletedDoc = await prisma.document.update({
    where: { document_id: documentId },
    data: {
      is_deleted: true,
      deleted_at: new Date(),
    },
  });
  // Xóa tài liệu trong Elasticsearch
  try {
    await deleteES(deletedDoc.document_id);
  } catch (err) {
    console.error('Error deleting document from Elasticsearch:', err);
  }
  return deletedDoc;
}

// Khôi phục tài liệu
async function restoreDocument(id) {
  const documentId = parseInt(id);

  if (isNaN(documentId)) {
    throw new Error('Document ID phải là một số hợp lệ');
  }

  const restoreDoc = await prisma.document.update({
    where: { document_id: documentId },
    data: {
      is_deleted: false,
      deleted_at: null,
    },
  });
  // Cập nhật lại tài liệu trong Elasticsearch
  try {
    await updateES(restoreDoc);
  } catch (err) {
    console.error('Error updating document in Elasticsearch:', err);
  }
  return restoreDoc;
}

async function forceDeleteDocument(id) {
  const documentId = parseInt(id);
  if (isNaN(documentId)) {
    throw new Error('Document ID phải là một số hợp lệ');
  }

  //Xoá vĩnh viễn các bình luận liên quan
  await prisma.comment.deleteMany({ where: { document_id: documentId } });
  // Xóa vĩnh viễn các đánh giá liên quan
  await prisma.rating.deleteMany({ where: { document_id: documentId } });

  // Xóa vĩnh viễn bài học
  try {
    const deleted = await prisma.document.delete({
      where: { document_id: documentId },
    });
    // Remove from Elasticsearch completely
    try {
      await deleteES(documentId, true);
    } catch (err) {
      console.error('Error hard-deleting document from Elasticsearch:', err);
    }
    return deleted;
  } catch (err) {
    throw err;
  }
}

// Duyệt tài liệu
async function approveDocument(id) {
  const approvedDoc = await prisma.document.update({
    where: { document_id: id },
    data: {
      status: 'approved',
      approved_at: new Date(),
    },
  });
  // Cập nhật dữ liệu tài liệu trong Elasticsearch
  await indexDocument(approvedDoc);
  return approvedDoc;
}

async function rejectAndDeleteDocument(
  id,
  rejectionReason = 'Tài liệu không hợp lệ'
) {
  const documentId = parseInt(id);
  if (isNaN(documentId)) {
    throw new Error('Document ID phải là một số hợp lệ');
  }
  // Lấy thông tin tài liệu trước khi xóa
  const document = await prisma.document.findUnique({
    where: { document_id: documentId },
    include: {
      uploader: {
        select: {
          user_id: true,
          full_name: true,
          email: true,
        },
      },
      subject: {
        select: {
          subject_name: true,
          subject_code: true,
        },
      },
      lecturer: {
        select: {
          lecturer_name: true,
        },
      },
    },
  });

  if (!document) {
    throw new Error('Document không tồn tại');
  }
  //Xóa tài liệu bị từ chối
  await prisma.comment.deleteMany({ where: { document_id: documentId } });
  await prisma.rating.deleteMany({ where: { document_id: documentId } });
  await prisma.document.delete({ where: { document_id: documentId } });

  // Also remove from Elasticsearch
  try {
    await deleteES(documentId, true);
  } catch (err) {
    console.error('Error removing rejected document from Elasticsearch:', err);
  }

  return {
    success: true,
    action: 'rejected_and_deleted',
    message: 'Tài liệu đã bị từ chối',
    deletedDocument: {
      title: document.title,
      uploader: document.uploader,
      subject: document.subject?.subject_name,
      lecturer: document.lecturer?.lecturer_name,
      rejectionReason,
      deletedAt: new Date(),
    },
  };
}

async function updateDocument(id, title, description) {
  const documentId = parseInt(id);

  if (isNaN(documentId)) {
    throw new Error('Document ID phải là một số hợp lệ');
  }

  const updatedDoc = await prisma.document.update({
    where: { document_id: documentId },
    data: {
      title,
      description,
    },
    include: {
      uploader: {
        select: {
          user_id: true,
          full_name: true,
          email: true,
        },
      },
      subject: {
        select: {
          subject_id: true,
          subject_name: true,
          subject_code: true,
        },
      },
      lecturer: {
        select: {
          lecturer_id: true,
          lecturer_name: true,
        },
      },
    },
  });
  // Cập nhật dữ liệu tài liệu trong Elasticsearch
  try {
    await updateES(updatedDoc);
  } catch (err) {
    console.error('Error updating document in Elasticsearch:', err);
  }
  return updatedDoc;
}

// Đếm số lượng documents theo điều kiện
async function countDocument(whereCondition) {
  return prisma.document.count({
    where: whereCondition,
  });
}

async function searchDocuments(query) {
  try {
    if (!query || query.trim() === '') {
      return [];
    }
    const results = await search(query);
    return results.map((hit) => hit._source);
  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
}

module.exports = {
  createDocumentRecord,
  getAllUserDocument,
  getAllDocuments,
  getDocumentByID,
  deleteDocument,
  getAverageRating,
  getCommentCount,
  restoreDocument,
  updateDocument,
  forceDeleteDocument,
  approveDocument,
  rejectAndDeleteDocument,
  countDocument,
  searchDocuments,
};
