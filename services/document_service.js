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

  // Convert BigInt to String for JSON serialization
  const docWithStats = { ...doc, avgRating, commentCount };
  if (docWithStats.file_size !== null && docWithStats.file_size !== undefined) {
    docWithStats.file_size = docWithStats.file_size.toString();
  }

  return docWithStats;
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
      file_size: uploadResult.fileSize ? BigInt(uploadResult.fileSize) : null,
      uploader_id: userId,
      subject_id: subject_id ? parseInt(subject_id) : null,
      lecturer_id: lecturer_id ? parseInt(lecturer_id) : null,
      status: 'pending',
    },
    include: BASIC_DOCUMENT_INCLUDE,
  });

  const newDocWithUpload = {
    ...newDoc,
    file_size: newDoc.file_size ? newDoc.file_size.toString() : null,
    upload: {
      fileUrl: uploadResult.fileUrl,
      fileType: uploadResult.fileType,
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
      publicId: uploadResult.publicId,
    },
  };

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
      file_size: true,
      status: true,
      uploaded_at: true,
      approved_at: true,
      is_starred: true,
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

  // Convert BigInt to String
  if (deletedDoc.file_size) {
    deletedDoc.file_size = deletedDoc.file_size.toString();
  }

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

  // Convert BigInt to String
  if (restoreDoc.file_size) {
    restoreDoc.file_size = restoreDoc.file_size.toString();
  }

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

  // Convert BigInt to String
  if (approvedDoc.file_size) {
    approvedDoc.file_size = approvedDoc.file_size.toString();
  }

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

  // Convert BigInt to String
  if (updatedDoc.file_size) {
    updatedDoc.file_size = updatedDoc.file_size.toString();
  }

  return updatedDoc;
}

// Get user storage statistics
async function getUserStorageStats(userId) {
  const result = await prisma.document.aggregate({
    where: {
      uploader_id: userId,
      is_deleted: false,
    },
    _sum: {
      file_size: true,
    },
    _count: {
      document_id: true,
    },
  });

  const totalSize = result._sum.file_size
    ? result._sum.file_size.toString()
    : '0';
  const totalDocuments = result._count.document_id;

  // Giả sử limit là 10GB = 10 * 1024 * 1024 * 1024 bytes
  const storageLimit = (10 * 1024 * 1024 * 1024).toString();

  return {
    totalSize,
    totalDocuments,
    storageLimit,
    usagePercentage: result._sum.file_size
      ? Number(
          (
            (Number(result._sum.file_size) / (10 * 1024 * 1024 * 1024)) *
            100
          ).toFixed(2)
        )
      : 0,
  };
}

async function countDocument(whereCondition) {
  return prisma.document.count({
    where: whereCondition,
  });
}

async function searchDocuments(query) {
  return search(query);
}

// Toggle star/unstar document
async function toggleStarDocument(documentId, userId) {
  const document = await prisma.document.findUnique({
    where: { document_id: documentId },
  });

  if (!document) {
    throw new Error('Không tìm thấy tài liệu');
  }

  // Check if user owns the document
  if (document.uploader_id !== userId) {
    throw new Error('Bạn không có quyền đánh dấu tài liệu này');
  }

  const updatedDocument = await prisma.document.update({
    where: { document_id: documentId },
    data: { is_starred: !document.is_starred },
  });

  return updatedDocument;
}

// Update last accessed time
async function updateLastAccessed(documentId, userId) {
  const document = await prisma.document.findUnique({
    where: { document_id: documentId },
  });

  if (!document) {
    throw new Error('Không tìm thấy tài liệu');
  }

  // Only update if user owns or has access to the document
  if (
    document.uploader_id === userId ||
    document.shared_with.includes(userId)
  ) {
    await prisma.document.update({
      where: { document_id: documentId },
      data: { last_accessed: new Date() },
    });
  }
}

// Share document with users
async function shareDocument(documentId, userId, sharedUserIds) {
  const document = await prisma.document.findUnique({
    where: { document_id: documentId },
  });

  if (!document) {
    throw new Error('Không tìm thấy tài liệu');
  }

  if (document.uploader_id !== userId) {
    throw new Error('Chỉ người tải lên mới có thể chia sẻ tài liệu');
  }

  const updatedDocument = await prisma.document.update({
    where: { document_id: documentId },
    data: {
      shared_with: {
        set: [...new Set([...document.shared_with, ...sharedUserIds])],
      },
    },
  });

  return updatedDocument;
}

// Get starred documents
async function getStarredDocuments(userId) {
  const documents = await prisma.document.findMany({
    where: {
      uploader_id: userId,
      is_starred: true,
      is_deleted: false,
    },
    select: {
      document_id: true,
      title: true,
      description: true,
      file_url: true,
      file_type: true,
      file_size: true,
      status: true,
      uploaded_at: true,
      approved_at: true,
      is_starred: true,
      last_accessed: true,
      uploader: {
        select: {
          user_id: true,
          full_name: true,
          email: true,
        },
      },
      subject: true,
      lecturer: true,
    },
    orderBy: { uploaded_at: 'desc' },
  });

  const enrichedDocuments = await Promise.all(
    documents.map(enrichDocumentWithStats)
  );

  return enrichedDocuments;
}

// Get recent documents (accessed in last 30 days)
async function getRecentDocuments(userId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const documents = await prisma.document.findMany({
    where: {
      uploader_id: userId,
      is_deleted: false,
      last_accessed: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      document_id: true,
      title: true,
      description: true,
      file_url: true,
      file_type: true,
      file_size: true,
      status: true,
      uploaded_at: true,
      approved_at: true,
      is_starred: true,
      last_accessed: true,
      uploader: {
        select: {
          user_id: true,
          full_name: true,
          email: true,
        },
      },
      subject: true,
      lecturer: true,
    },
    orderBy: { last_accessed: 'desc' },
    take: 50, // Limit to 50 recent documents
  });

  const enrichedDocuments = await Promise.all(
    documents.map(enrichDocumentWithStats)
  );

  return enrichedDocuments;
}

// Get shared documents
async function getSharedDocuments(userId) {
  const documents = await prisma.document.findMany({
    where: {
      shared_with: {
        has: userId,
      },
      is_deleted: false,
    },
    select: {
      document_id: true,
      title: true,
      description: true,
      file_url: true,
      file_type: true,
      file_size: true,
      status: true,
      uploaded_at: true,
      approved_at: true,
      is_starred: true,
      last_accessed: true,
      uploader: {
        select: {
          user_id: true,
          full_name: true,
          email: true,
        },
      },
      subject: true,
      lecturer: true,
    },
    orderBy: { uploaded_at: 'desc' },
  });

  const enrichedDocuments = await Promise.all(
    documents.map(enrichDocumentWithStats)
  );

  return enrichedDocuments;
}

module.exports = {
  // Create & Read
  createDocumentRecord,
  getAllUserDocument,
  getAllDocuments,
  getDocumentByID,

  // Update
  updateDocument,
  approveDocument,
  toggleStarDocument,
  updateLastAccessed,
  shareDocument,

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
  getUserStorageStats,

  // New features
  getStarredDocuments,
  getRecentDocuments,
  getSharedDocuments,
};
