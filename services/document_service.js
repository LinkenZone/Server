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

  // Transform tags from DocumentTag[] to Tag[]
  if (docWithStats.tags && Array.isArray(docWithStats.tags)) {
    docWithStats.tags = docWithStats.tags.map((dt) => dt.tag);
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
  tags: {
    select: {
      tag: true,
    },
  },
};

const BASIC_DOCUMENT_INCLUDE = {
  uploader: { select: UPLOADER_SELECT },
  tags: {
    select: {
      tag: true,
    },
  },
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

  await safeElasticsearchOperation(
    () => indexDocument(newDocWithUpload),
    'Error indexing new document in Elasticsearch:'
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

async function getApprovedDocuments(page, pageSize) {
  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where: { status: 'approved', is_deleted: false },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: BASIC_DOCUMENT_INCLUDE,
    }),
    prisma.document.count({
      where: { status: 'approved', is_deleted: false },
    }),
  ]);

  return {
    documents: await Promise.all(documents.map(enrichDocumentWithStats)),
    total,
  };
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

  return {
    totalSize,
    totalDocuments,
  };
}

// ============== TAG MANAGEMENT ==============

// Lấy tất cả tags của một document
async function getDocumentTags(documentId) {
  const parsedId = validateAndParseId(documentId);

  const documentTags = await prisma.documentTag.findMany({
    where: { document_id: parsedId },
    include: {
      tag: true,
    },
  });

  return documentTags.map((dt) => dt.tag);
}

// Cập nhật tags của document (thêm, xóa, tạo mới)
async function updateDocumentTags(documentId, { tagIds, newTags }) {
  const parsedId = validateAndParseId(documentId);

  // Kiểm tra document có tồn tại không
  const document = await prisma.document.findUnique({
    where: { document_id: parsedId },
  });

  if (!document) {
    throw new Error('Document không tồn tại');
  }

  // Bước 1: Tạo tags mới nếu có
  const createdTags = [];
  if (newTags && newTags.length > 0) {
    for (const newTag of newTags) {
      if (!newTag.tag_name || newTag.tag_name.trim() === '') {
        continue;
      }

      // Kiểm tra tag đã tồn tại chưa
      const existingTag = await prisma.tag.findUnique({
        where: { tag_name: newTag.tag_name.trim() },
      });

      if (existingTag) {
        // Nếu tag đã tồn tại, thêm vào danh sách tagIds
        if (!tagIds.includes(existingTag.tag_id)) {
          tagIds.push(existingTag.tag_id);
        }
      } else {
        // Tạo tag mới
        const created = await prisma.tag.create({
          data: {
            tag_name: newTag.tag_name.trim(),
            description: newTag.description || null,
            color: newTag.color || null,
          },
        });
        createdTags.push(created);
        tagIds.push(created.tag_id);
      }
    }
  }

  // Bước 2: Xóa tất cả tags hiện tại của document
  await prisma.documentTag.deleteMany({
    where: { document_id: parsedId },
  });

  // Bước 3: Thêm các tags mới
  if (tagIds && tagIds.length > 0) {
    const documentTagsData = tagIds.map((tagId) => ({
      document_id: parsedId,
      tag_id: tagId,
    }));

    await prisma.documentTag.createMany({
      data: documentTagsData,
      skipDuplicates: true,
    });
  }

  // Bước 4: Lấy danh sách tags sau khi cập nhật
  const updatedTags = await getDocumentTags(parsedId);

  return {
    tags: updatedTags,
    createdTags,
    message: 'Cập nhật tags thành công',
  };
}

// ============== STARRED, RECENT, SHARED DOCUMENTS ==============
async function searchDocuments(query, page, limit) {
  // Get search results from Elasticsearch
  const results = await search(query, page, limit);

  // Enrich each document with tags from database
  const enrichedResults = await Promise.all(
    results.documents.map(async (doc) => {
      const fullDoc = await prisma.document.findUnique({
        where: { document_id: doc.document_id },
        include: {
          tags: {
            select: {
              tag: true,
            },
          },
        },
      });

      // Transform tags
      const tags = fullDoc?.tags ? fullDoc.tags.map((dt) => dt.tag) : [];

      return {
        ...doc,
        tags,
      };
    })
  );

  return { documents: enrichedResults, total: results.total };
}
// Toggle star/unstar document
async function toggleStarDocument(documentId, userId) {
  const parsedId = validateAndParseId(documentId);

  const document = await prisma.document.findUnique({
    where: { document_id: parsedId },
  });

  if (!document) {
    throw new Error('Document không tồn tại');
  }

  // Check if user is the owner
  if (document.uploader_id !== userId) {
    throw new Error('Chỉ có thể đánh dấu sao tài liệu của chính bạn');
  }

  const newStarredStatus = !document.is_starred;

  const updatedDoc = await prisma.document.update({
    where: { document_id: parsedId },
    data: {
      is_starred: newStarredStatus,
      last_accessed: new Date(),
    },
  });

  return {
    ...updatedDoc,
    file_size: updatedDoc.file_size ? updatedDoc.file_size.toString() : null,
  };
}

// Get starred documents for a user
async function getStarredDocuments(userId) {
  const documents = await prisma.document.findMany({
    where: {
      uploader_id: userId,
      is_starred: true,
      is_deleted: false,
    },
    include: BASIC_DOCUMENT_INCLUDE,
    orderBy: {
      last_accessed: 'desc',
    },
  });

  return Promise.all(documents.map(enrichDocumentWithStats));
}

// Get recent documents for a user
async function getRecentDocuments(userId, limit = 20) {
  const documents = await prisma.document.findMany({
    where: {
      uploader_id: userId,
      is_deleted: false,
      last_accessed: {
        not: null,
      },
    },
    include: BASIC_DOCUMENT_INCLUDE,
    orderBy: {
      last_accessed: 'desc',
    },
    take: limit,
  });

  return Promise.all(documents.map(enrichDocumentWithStats));
}

// Get shared documents (documents shared with the user)
async function getSharedDocuments(userId) {
  const documents = await prisma.document.findMany({
    where: {
      shared_with: {
        has: userId,
      },
      is_deleted: false,
    },
    include: BASIC_DOCUMENT_INCLUDE,
    orderBy: {
      uploaded_at: 'desc',
    },
  });

  return Promise.all(documents.map(enrichDocumentWithStats));
}

// Share document with other users
async function shareDocument(documentId, ownerId, userIds) {
  const parsedId = validateAndParseId(documentId);

  const document = await prisma.document.findUnique({
    where: { document_id: parsedId },
  });

  if (!document) {
    throw new Error('Document không tồn tại');
  }

  // Check if user is the owner
  if (document.uploader_id !== ownerId) {
    throw new Error('Chỉ có thể chia sẻ tài liệu của chính bạn');
  }

  // Add new user IDs to shared_with array
  const currentSharedWith = document.shared_with || [];
  const updatedSharedWith = [...new Set([...currentSharedWith, ...userIds])];

  const updatedDoc = await prisma.document.update({
    where: { document_id: parsedId },
    data: {
      shared_with: updatedSharedWith,
    },
  });

  return {
    ...updatedDoc,
    file_size: updatedDoc.file_size ? updatedDoc.file_size.toString() : null,
    shared_with_count: updatedSharedWith.length,
  };
}

// Update last accessed time for a document
async function updateLastAccessed(documentId, userId) {
  const parsedId = validateAndParseId(documentId);

  // Update last accessed time
  await prisma.document.update({
    where: { document_id: parsedId },
    data: {
      last_accessed: new Date(),
    },
  });
}

module.exports = {
  // Create & Read
  createDocumentRecord,
  getAllUserDocument,
  getAllDocuments,
  getApprovedDocuments,
  getDocumentByID,
  searchDocuments,
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
  getUserStorageStats,

  // Tag management
  getDocumentTags,
  updateDocumentTags,

  // Starred, recent, shared documents
  toggleStarDocument,
  getStarredDocuments,
  getRecentDocuments,
  getSharedDocuments,
  shareDocument,
  updateLastAccessed,
};
