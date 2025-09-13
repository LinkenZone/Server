const prisma = require('../utils/db');

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
}

module.exports = { createDocumentRecord };
