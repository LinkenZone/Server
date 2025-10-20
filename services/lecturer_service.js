const prisma = require('../utils/db');

async function createLecturer(data) {
  const { lecturer_name } = data;
  if (!lecturer_name || lecturer_name.trim() === '') {
    throw new Error('lecturer_name is required');
  }

  // Prevent duplicates by name
  const existing = await prisma.lecturer.findFirst({ where: { lecturer_name: lecturer_name.trim() } });
  if (existing) {
    throw new Error('Lecturer already exists');
  }

  return prisma.lecturer.create({ data: { lecturer_name: lecturer_name.trim() } });
}

async function deleteLecturerById(id) {
  const lecturerId = Number(id);
  if (isNaN(lecturerId)) throw new Error('Invalid lecturer id');

  // Option: set documents' lecturer_id to null (handled by FK onDelete SetNull in schema)
  return prisma.lecturer.delete({ where: { lecturer_id: lecturerId } });
}

module.exports = {
  createLecturer,
  deleteLecturerById,
};
