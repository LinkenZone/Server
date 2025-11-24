const prisma = require('../utils/db');

// Lấy tất cả tags với số lượng documents
async function getAllTags() {
  const tags = await prisma.tag.findMany({
    include: {
      _count: {
        select: { documents: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return tags.map((tag) => ({
    tag_id: tag.tag_id,
    tag_name: tag.tag_name,
    description: tag.description,
    color: tag.color,
    document_count: tag._count.documents,
    created_at: tag.created_at,
    updated_at: tag.updated_at,
  }));
}

// Lấy tag theo ID
async function getTagById(tagId) {
  const tag = await prisma.tag.findUnique({
    where: { tag_id: tagId },
    include: {
      _count: {
        select: { documents: true },
      },
    },
  });

  if (!tag) {
    throw new Error('Không tìm thấy tag');
  }

  return {
    tag_id: tag.tag_id,
    tag_name: tag.tag_name,
    description: tag.description,
    color: tag.color,
    document_count: tag._count.documents,
    created_at: tag.created_at,
    updated_at: tag.updated_at,
  };
}

// Tạo tag mới
async function createTag(tagData) {
  const { tag_name, description, color } = tagData;

  // Kiểm tra trùng tên
  const existing = await prisma.tag.findUnique({
    where: { tag_name },
  });

  if (existing) {
    throw new Error('Tag đã tồn tại');
  }

  const tag = await prisma.tag.create({
    data: {
      tag_name: tag_name.trim(),
      description: description?.trim() || null,
      color: color || '#3B82F6', // default blue
    },
  });

  return tag;
}

// Cập nhật tag
async function updateTag(tagId, tagData) {
  const { tag_name, description, color } = tagData;

  const tag = await prisma.tag.findUnique({
    where: { tag_id: tagId },
  });

  if (!tag) {
    throw new Error('Không tìm thấy tag');
  }

  // Kiểm tra trùng tên (nếu đổi tên)
  if (tag_name && tag_name !== tag.tag_name) {
    const existing = await prisma.tag.findUnique({
      where: { tag_name },
    });
    if (existing) {
      throw new Error('Tên tag đã tồn tại');
    }
  }

  const updated = await prisma.tag.update({
    where: { tag_id: tagId },
    data: {
      tag_name: tag_name?.trim() || tag.tag_name,
      description:
        description !== undefined ? description?.trim() : tag.description,
      color: color || tag.color,
    },
  });

  return updated;
}

// Xóa tag
async function deleteTag(tagId) {
  const tag = await prisma.tag.findUnique({
    where: { tag_id: tagId },
    include: {
      _count: {
        select: { documents: true },
      },
    },
  });

  if (!tag) {
    throw new Error('Không tìm thấy tag');
  }

  // Xóa tag (cascade sẽ tự động xóa relations trong document_tags)
  await prisma.tag.delete({
    where: { tag_id: tagId },
  });

  return {
    message: `Đã xóa tag "${tag.tag_name}" và ${tag._count.documents} liên kết với documents`,
  };
}

// Lấy documents theo tag
async function getDocumentsByTag(tagId, options = {}) {
  const { skip = 0, take = 20 } = options;

  const tag = await prisma.tag.findUnique({
    where: { tag_id: tagId },
    include: {
      documents: {
        include: {
          document: {
            include: {
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
          },
        },
        skip,
        take,
      },
    },
  });

  if (!tag) {
    throw new Error('Không tìm thấy tag');
  }

  return {
    tag,
    documents: tag.documents.map((dt) => dt.document),
  };
}

// Gán tags cho document
async function assignTagsToDocument(documentId, tagIds) {
  // Xóa tất cả tags hiện tại của document
  await prisma.documentTag.deleteMany({
    where: { document_id: documentId },
  });

  // Thêm tags mới
  if (tagIds && tagIds.length > 0) {
    await prisma.documentTag.createMany({
      data: tagIds.map((tagId) => ({
        document_id: documentId,
        tag_id: tagId,
      })),
      skipDuplicates: true,
    });
  }

  return { message: 'Cập nhật tags thành công' };
}

module.exports = {
  getAllTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  getDocumentsByTag,
  assignTagsToDocument,
};
