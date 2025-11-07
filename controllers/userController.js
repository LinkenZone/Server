const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const userService = require('../services/userService');

// Get all users (admin)
exports.getAllUsers = catchAsync(async (req, res, next) => {
  console.log('📋 Getting all users - User:', req.user?.email);
  console.log('📋 User role:', req.user?.role);

  const users = await userService.listUsers();

  console.log('✅ Found users:', users.length);

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users },
  });
});

// Get user details by id (admin)
exports.getUserDetails = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return next(new AppError('ID không hợp lệ', 400));

  const user = await userService.getUserById(id);

  if (!user) return next(new AppError('Không tìm thấy user', 404));

  res.status(200).json({ status: 'success', data: { user } });
});

// Change user role - admin
exports.changeUserRole = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return next(new AppError('ID không hợp lệ', 400));

  const { role } = req.body;
  if (!role || !['admin', 'user'].includes(role)) {
    return next(new AppError('Vai trò không hợp lệ', 400));
  }

  const updated = await userService.changeUserRoleById(id, role);
  if (updated.count === 0)
    return next(new AppError('Không tìm thấy user', 404));

  res
    .status(200)
    .json({ status: 'success', message: 'Vai trò user đã được cập nhật' });
});

// Ban user (soft ban) - admin
exports.banUser = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return next(new AppError('ID không hợp lệ', 400));

  const updated = await userService.banUserById(id);

  if (updated.count === 0)
    return next(new AppError('Không tìm thấy user', 404));

  res.status(200).json({ status: 'success', message: 'User đã bị cấm' });
});

// Unban user - admin
exports.unbanUser = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return next(new AppError('ID không hợp lệ', 400));

  const updated = await userService.unbanUserById(id);

  if (updated.count === 0)
    return next(new AppError('Không tìm thấy user', 404));

  res.status(200).json({ status: 'success', message: 'User đã được gỡ cấm' });
});

// Soft delete user
exports.deleteUser = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return next(new AppError('ID không hợp lệ', 400));

  const updated = await userService.softDeleteUserById(id);

  if (updated.count === 0)
    return next(new AppError('Không tìm thấy user', 404));

  res
    .status(200)
    .json({ status: 'success', message: 'User đã được xóa (soft delete)' });
});

// legacy commented code kept for reference
