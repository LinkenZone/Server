const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const prisma = require('../utils/db');
const lecturerService = require('../services/lecturer_service');

// Create a new subject (admin)
exports.createSubject = catchAsync(async (req, res, next) => {
  const { subject_name, subject_code } = req.body;

  if (!subject_name || subject_name.trim() === '') {
    return next(new AppError('subject_name là bắt buộc', 400));
  }

  // Avoid duplicate subject names
  const existing = await prisma.subject.findUnique({
    where: { subject_name },
  });
  if (existing) return next(new AppError('Subject đã tồn tại', 400));

  const subject = await prisma.subject.create({
    data: {
      subject_name: subject_name.trim(),
      subject_code: subject_code ? subject_code.trim() : null,
    },
  });

  res.status(201).json({ status: 'success', data: { subject } });
});

// Update an existing subject
exports.updateSubject = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return next(new AppError('ID không hợp lệ', 400));

  const { subject_name, subject_code } = req.body;

  const subject = await prisma.subject.findUnique({ where: { subject_id: id } });
  if (!subject) return next(new AppError('Không tìm thấy subject', 404));

  const updated = await prisma.subject.update({
    where: { subject_id: id },
    data: {
      subject_name: subject_name ? subject_name.trim() : subject.subject_name,
      subject_code: subject_code !== undefined ? (subject_code ? subject_code.trim() : null) : subject.subject_code,
    },
  });

  res.status(200).json({ status: 'success', data: { subject: updated } });
});

// Delete a subject
exports.deleteSubject = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return next(new AppError('ID không hợp lệ', 400));

  const subject = await prisma.subject.findUnique({ where: { subject_id: id } });
  if (!subject) return next(new AppError('Không tìm thấy subject', 404));

  await prisma.subject.delete({ where: { subject_id: id } });

  res.status(204).json({ status: 'success', data: null });
});

// Placeholder for other admin actions (users, lecturers, documents)

// Create lecturer
exports.createLecturer = catchAsync(async (req, res, next) => {
  try {
    const lecturer = await lecturerService.createLecturer(req.body);
    res.status(201).json({ status: 'success', data: { lecturer } });
  } catch (err) {
    return next(new AppError(err.message || 'Lỗi khi tạo lecturer', 400));
  }
});

// Delete lecturer
exports.deleteLecturer = catchAsync(async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return next(new AppError('ID không hợp lệ', 400));
    await lecturerService.deleteLecturerById(id);
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    return next(new AppError(err.message || 'Lỗi khi xóa lecturer', 400));
  }
});
