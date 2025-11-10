const prisma = require('../utils/db');
const {
  indexDocument,
  updateES,
  deleteES,
  search,
} = require('../utils/elastic');
const { deleteFileByUrl } = require('./cloudinary_service');

function validateAndParseId(id) {
  const documentId = parseInt(id);
  if (isNaN(documentId)) {
    throw new Error('Document ID phải là một số hợp lệ');
  }
  return documentId;
}

async function getAverageRating(documentId) {
  const result = await prisma.rating.aggregate({
    where: { document_id: documentId },
    _avg: { score: true },
  });
  return result._avg.score ?? null;
}

async function getCommentCount(documentId) {
  return prisma.comment.count({
    where: { document_id: documentId },
  });
}

async function enrichDocumentWithStats(doc) {
  const avgRating = await getAverageRating(doc.document_id);
  const commentCount = await getCommentCount(doc.document_id);
  return { ...doc, avgRating, commentCount };
}

async function safeElasticsearchOperation(esOperation, errorMessage) {
  try {
    await esOperation();
  } catch (err) {
    console.error(errorMessage, err);
  }
}

async function deleteRelatedData(documentId) {
  await Promise.all([
    prisma.comment.deleteMany({ where: { document_id: documentId } }),
    prisma.rating.deleteMany({ where: { document_id: documentId } }),
  ]);
}

// ==================== INCLUDE CONFIGURATIONS ====================

const UPLOADER_SELECT = {
  user_id: true,
  full_name: true,
  email: true,
};

const SUBJECT_SELECT = {
  subject_id: true,
  subject_name: true,
  subject_code: true,
};

const LECTURER_SELECT = {
  lecturer_id: true,
  lecturer_name: true,
};

const FULL_DOCUMENT_INCLUDE = {
  uploader: { select: UPLOADER_SELECT },
  subject: { select: SUBJECT_SELECT },
  lecturer: { select: LECTURER_SELECT },
};

const BASIC_DOCUMENT_INCLUDE = {
  uploader: { select: UPLOADER_SELECT },
};

// ==================== MAIN FUNCTIONS ====================
async function createDocumentRecord(uploadResult, documentData, userId) {
  const { title, description, subject_id, lecturer_id } = documentData;

  const newDoc = await prisma.document.create({
    data: {
      title,
      description,
      file_url: uploadResult.fileUrl,
      file_type: uploadResult.fileType,
      uploader_id: userId,
      subject_id: subject_id ? parseInt(subject_id) : null,
      lecturer_id: lecturer_id ? parseInt(lecturer_id) : null,
      status: 'pending',
    },
    include: BASIC_DOCUMENT_INCLUDE,
  });

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

  await safeElasticsearchOperation(
    () => indexDocument(newDocWithUpload),
    'Elasticsearch indexing failed for new document:'
  );

  return newDocWithUpload;
}

async function getAllUserDocument(user_id, is_deleted) {
  const documents = await prisma.document.findMany({
    where: { uploader_id: user_id, is_deleted },
    select: {
      document_id: true,
      title: true,
      description: true,
      file_url: true,
      file_type: true,
      status: true,
      uploaded_at: true,
      approved_at: true,
    },
    orderBy: { uploaded_at: 'desc' },
  });

  return Promise.all(documents.map(enrichDocumentWithStats));
}

async function getAllDocuments() {
  const documents = await prisma.document.findMany({
    include: BASIC_DOCUMENT_INCLUDE,
    orderBy: { uploaded_at: 'desc' },
  });

  return Promise.all(documents.map(enrichDocumentWithStats));
}

async function getDocumentByID(id) {
  const documentId = validateAndParseId(id);

  const doc = await prisma.document.findUnique({
    where: { document_id: documentId },
    include: FULL_DOCUMENT_INCLUDE,
  });

  if (!doc) {
    return null;
  }

  return enrichDocumentWithStats(doc);
}

async function deleteDocument(id) {
  const documentId = validateAndParseId(id);

  const deletedDoc = await prisma.document.update({
    where: { document_id: documentId },
    data: {
      is_deleted: true,
      deleted_at: new Date(),
    },
  });

  await safeElasticsearchOperation(
    () => deleteES(deletedDoc.document_id),
    'Error deleting document from Elasticsearch:'
  );

  return deletedDoc;
}

async function restoreDocument(id) {
  const documentId = validateAndParseId(id);

  const restoreDoc = await prisma.document.update({
    where: { document_id: documentId },
    data: {
      is_deleted: false,
      deleted_at: null,
    },
  });

  await safeElasticsearchOperation(
    () => updateES(restoreDoc),
    'Error updating document in Elasticsearch:'
  );

  return restoreDoc;
}

async function forceDeleteDocument(id) {
  const documentId = validateAndParseId(id);

  // Lấy thông tin document trước khi xóa (để có file_url)
  const document = await prisma.document.findUnique({
    where: { document_id: documentId },
    select: { file_url: true },
  });

  if (!document) {
    throw new Error('Document không tồn tại');
  }

  // Xóa dữ liệu liên quan
  await deleteRelatedData(documentId);

  // Xóa document trong database
  const deleted = await prisma.document.delete({
    where: { document_id: documentId },
  });

  // Xóa trong Elasticsearch
  await safeElasticsearchOperation(
    () => deleteES(documentId, true),
    'Error hard-deleting document from Elasticsearch:'
  );

  // Xóa file trên Cloudinary
  if (document.file_url) {
    await safeElasticsearchOperation(
      () => deleteFileByUrl(document.file_url),
      'Error deleting file from Cloudinary:'
    );
  }

  return deleted;
}

async function approveDocument(id) {
  const documentId = validateAndParseId(id);

  const approvedDoc = await prisma.document.update({
    where: { document_id: documentId },
    data: {
      status: 'approved',
      approved_at: new Date(),
    },
  });

  await safeElasticsearchOperation(
    () => indexDocument(approvedDoc),
    'Error indexing approved document in Elasticsearch:'
  );

  return approvedDoc;
}

async function rejectAndDeleteDocument(
  id,
  rejectionReason = 'Tài liệu không hợp lệ'
) {
  const documentId = validateAndParseId(id);

  const document = await prisma.document.findUnique({
    where: { document_id: documentId },
    include: FULL_DOCUMENT_INCLUDE,
  });

  if (!document) {
    throw new Error('Document không tồn tại');
  }

  await deleteRelatedData(documentId);
  await prisma.document.delete({ where: { document_id: documentId } });

  await safeElasticsearchOperation(
    () => deleteES(documentId, true),
    'Error removing rejected document from Elasticsearch:'
  );

  // Xóa file trên Cloudinary
  if (document.file_url) {
    await safeElasticsearchOperation(
      () => deleteFileByUrl(document.file_url),
      'Error deleting rejected file from Cloudinary:'
    );
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
  const documentId = validateAndParseId(id);

  const updatedDoc = await prisma.document.update({
    where: { document_id: documentId },
    data: { title, description },
    include: FULL_DOCUMENT_INCLUDE,
  });

  await safeElasticsearchOperation(
    () => updateES(updatedDoc),
    'Error updating document in Elasticsearch:'
  );

  return updatedDoc;
}

async function countDocument(whereCondition) {
  return prisma.document.count({
    where: whereCondition,
  });
}

async function searchDocuments(query) {
  if (!query || query.trim() === '') {
    return [];
  }

  try {
    const results = await search(query);
    return results.map((hit) => hit._source);
  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
}

async function getDocumentsBySubjectType(subjectType) {
  const documents = await prisma.document.findMany({
    where: {
      status: 'approved',
      is_deleted: false,
      subject: {
        subject_type: subjectType,
      },
    },
    include: FULL_DOCUMENT_INCLUDE,
    orderBy: { uploaded_at: 'desc' },
  });

  return Promise.all(documents.map(enrichDocumentWithStats));
}

async function getTopRatedDocuments(limit = 10) {
  // Lấy tất cả documents đã được approved và không bị xóa
  const documents = await prisma.document.findMany({
    where: {
      status: 'approved',
      is_deleted: false,
    },
    include: FULL_DOCUMENT_INCLUDE,
  });

  // Tính average rating cho từng document
  const documentsWithRating = await Promise.all(
    documents.map(async (doc) => {
      const avgRating = await getAverageRating(doc.document_id);
      const commentCount = await getCommentCount(doc.document_id);
      const ratingCount = await prisma.rating.count({
        where: { document_id: doc.document_id },
      });
      
      return {
        ...doc,
        avgRating,
        commentCount,
        ratingCount,
      };
    })
  );

  // Lọc những document có rating và sắp xếp theo avgRating giảm dần
  const topRated = documentsWithRating
    .filter((doc) => doc.avgRating !== null && doc.ratingCount > 0)
    .sort((a, b) => {
      // Sắp xếp theo avgRating giảm dần, nếu bằng nhau thì theo ratingCount
      if (b.avgRating !== a.avgRating) {
        return b.avgRating - a.avgRating;
      }
      return b.ratingCount - a.ratingCount;
    })
    .slice(0, limit);

  return topRated;
}

// ==================== EXPORTS ====================

module.exports = {
  // Create & Read
  createDocumentRecord,
  getAllUserDocument,
  getAllDocuments,
  getDocumentByID,

  // Update
  updateDocument,
  approveDocument,

  // Delete
  deleteDocument,
  restoreDocument,
  forceDeleteDocument,
  rejectAndDeleteDocument,

  // Utilities
  getAverageRating,
  getCommentCount,
  countDocument,
  searchDocuments,
  
  // New functions
  getDocumentsBySubjectType,
  getTopRatedDocuments,
};
