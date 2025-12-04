const prisma = require('../utils/db');
const { search } = require('../utils/elastic');

/**
 * Hàm helper để enrich document với thông tin thêm (avgRating, commentCount, tags)
 */
async function enrichDocumentWithDetails(doc) {
  // Calculate average rating
  const avgRatingResult = await prisma.rating.aggregate({
    where: { document_id: doc.document_id },
    _avg: { score: true },
  });
  const avgRating = avgRatingResult._avg.score ?? null;

  // Count comments
  const commentCount = await prisma.comment.count({
    where: { document_id: doc.document_id },
  });

  // Convert BigInt to String
  const enrichedDoc = { ...doc, avgRating, commentCount };
  if (enrichedDoc.file_size !== null && enrichedDoc.file_size !== undefined) {
    enrichedDoc.file_size = enrichedDoc.file_size.toString();
  }

  // Transform tags from DocumentTag[] to Tag[]
  if (enrichedDoc.tags && Array.isArray(enrichedDoc.tags)) {
    enrichedDoc.tags = enrichedDoc.tags.map((dt) => dt.tag);
  }

  return enrichedDoc;
}

/**
 * Lọc tài liệu theo tags và các tiêu chí khác (sử dụng Prisma)
 */
async function filterDocuments(filters) {
  const {
    tagIds = [],
    searchQuery,
    status,
    subjectId,
    lecturerId,
    uploaderId,
    page = 1,
    limit = 10,
    sortBy = 'uploaded_at',
    sortOrder = 'desc',
  } = filters;

  // Build where clause
  const whereClause = {
    is_deleted: false,
    status: 'approved', // Chỉ lấy documents đã được duyệt
  };

  // Filter by status (nếu muốn lấy cả pending/rejected)
  if (status) {
    whereClause.status = status;
  }

  // Filter by subject
  if (subjectId) {
    whereClause.subject_id = subjectId;
  }

  // Filter by lecturer
  if (lecturerId) {
    whereClause.lecturer_id = lecturerId;
  }

  // Filter by uploader
  if (uploaderId) {
    whereClause.uploader_id = uploaderId;
  }

  // Filter by search query (title or description)
  if (searchQuery && searchQuery.trim() !== '') {
    whereClause.OR = [
      { title: { contains: searchQuery, mode: 'insensitive' } },
      { description: { contains: searchQuery, mode: 'insensitive' } },
    ];
  }

  // Filter by tags
  if (tagIds.length > 0) {
    whereClause.tags = {
      some: {
        tag_id: {
          in: tagIds,
        },
      },
    };
  }

  // Build orderBy clause
  const orderByClause = {};
  if (sortBy === 'uploaded_at') {
    orderByClause.uploaded_at = sortOrder;
  } else if (sortBy === 'title') {
    orderByClause.title = sortOrder;
  } else if (sortBy === 'approved_at') {
    orderByClause.approved_at = sortOrder;
  }

  // Get total count
  const total = await prisma.document.count({
    where: whereClause,
  });

  // Get documents
  const documents = await prisma.document.findMany({
    where: whereClause,
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
      tags: {
        include: {
          tag: true,
        },
      },
    },
    orderBy: orderByClause,
    skip: (page - 1) * limit,
    take: limit,
  });

  // Enrich documents with avgRating and commentCount
  const enrichedDocuments = await Promise.all(
    documents.map((doc) => enrichDocumentWithDetails(doc))
  );

  return {
    documents: enrichedDocuments,
    total,
  };
}

/**
 * Tìm kiếm tài liệu với Elasticsearch và lọc theo tags
 * Kết hợp sức mạnh của Elasticsearch cho full-text search
 * và Prisma để lọc theo tags
 */
async function searchDocumentsWithTags(filters) {
  const {
    tagIds = [],
    searchQuery,
    status,
    subjectId,
    lecturerId,
    page = 1,
    limit = 10,
  } = filters;

  // Bước 1: Tìm kiếm với Elasticsearch để lấy document IDs phù hợp
  const esResults = await search(searchQuery, page, limit);

  if (esResults.total === 0 || esResults.documents.length === 0) {
    return {
      documents: [],
      total: 0,
    };
  }

  // Lấy danh sách document IDs từ Elasticsearch
  const documentIds = esResults.documents.map((doc) => doc.document_id);

  // Bước 2: Build where clause cho Prisma với document IDs từ ES
  const whereClause = {
    document_id: {
      in: documentIds,
    },
    is_deleted: false,
  };

  // Filter by status
  if (status) {
    whereClause.status = status;
  } else {
    whereClause.status = 'approved'; // Mặc định chỉ lấy approved
  }

  // Filter by subject
  if (subjectId) {
    whereClause.subject_id = subjectId;
  }

  // Filter by lecturer
  if (lecturerId) {
    whereClause.lecturer_id = lecturerId;
  }

  // Filter by tags (quan trọng!)
  if (tagIds.length > 0) {
    whereClause.tags = {
      some: {
        tag_id: {
          in: tagIds,
        },
      },
    };
  }

  // Bước 3: Lấy documents từ Prisma với các filter
  const documents = await prisma.document.findMany({
    where: whereClause,
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
      tags: {
        include: {
          tag: true,
        },
      },
    },
    orderBy: {
      uploaded_at: 'desc',
    },
  });

  // Count total matching documents
  const total = await prisma.document.count({
    where: whereClause,
  });

  // Enrich documents
  const enrichedDocuments = await Promise.all(
    documents.map((doc) => enrichDocumentWithDetails(doc))
  );

  return {
    documents: enrichedDocuments,
    total,
  };
}

/**
 * Lấy tất cả tags có sẵn trong hệ thống
 */
async function getAllTags() {
  const tags = await prisma.tag.findMany({
    orderBy: {
      tag_name: 'asc',
    },
  });

  return tags;
}

/**
 * Lấy thống kê số lượng documents theo từng tag
 */
async function getTagStatistics() {
  const tags = await prisma.tag.findMany({
    include: {
      documents: {
        where: {
          document: {
            is_deleted: false,
            status: 'approved',
          },
        },
      },
    },
    orderBy: {
      tag_name: 'asc',
    },
  });

  const statistics = tags.map((tag) => ({
    tag_id: tag.tag_id,
    tag_name: tag.tag_name,
    description: tag.description,
    color: tag.color,
    document_count: tag.documents.length,
  }));

  return statistics;
}

/**
 * Lấy các tags phổ biến nhất (có nhiều documents nhất)
 */
async function getPopularTags(limit = 10) {
  // Sử dụng raw query để tối ưu performance
  const popularTags = await prisma.$queryRaw`
    SELECT 
      t.tag_id,
      t.tag_name,
      t.description,
      t.color,
      COUNT(dt.document_id) as document_count
    FROM tags t
    LEFT JOIN document_tags dt ON t.tag_id = dt.tag_id
    LEFT JOIN documents d ON dt.document_id = d.document_id
    WHERE d.is_deleted = false AND d.status = 'approved'
    GROUP BY t.tag_id, t.tag_name, t.description, t.color
    ORDER BY document_count DESC
    LIMIT ${limit}
  `;

  // Convert BigInt to Number
  return popularTags.map((tag) => ({
    ...tag,
    document_count: Number(tag.document_count),
  }));
}

module.exports = {
  filterDocuments,
  searchDocumentsWithTags,
  getAllTags,
  getTagStatistics,
  getPopularTags,
};
