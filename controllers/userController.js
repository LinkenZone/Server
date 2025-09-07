// const User = require('../Models/userModel');
// const catchAsync = require('../utils/catchAsync');
// const appError = require('../utils/appError');

// const filterObj = (obj, ...allowedFields) => {
//   const newObj = {};
//   Object.keys(obj).forEach((cur) => {
//     if (allowedFields.includes(cur)) newObj[cur] = obj[cur];
//   });
//   return newObj;
// };
// exports.getAllUsers = catchAsync(async (req, res, next) => {
//   const users = await User.find();

//   res.status(200).json({
//     status: 'success',
//     results: users.length,
//     data: {
//       users,
//     },
//   });
// });

// exports.updateMe = catchAsync(async (req, res, next) => {
//   //1. Tạo lỗi nếu user post password
//   if (req.body.password || req.body.passwordConfirm) {
//     return next(new appError('Không được cập nhật password ở đây', 400));
//   }
//   //2. Cập nhật user data
//   const filteredBody = filterObj(req.body, 'name', 'email');
//   const user = await User.findByIdAndUpdate(req.user.id, filteredBody, {
//     new: true,
//     runValidators: true,
//   });

//   res.status(200).json({
//     status: 'success',
//     data: {
//       user,
//     },
//   });
// });

// exports.deleteMe = catchAsync(async (req, res, next) => {
//   await User.findByIdAndUpdate(req.user.id, { active: false });

//   res.status(202).json({
//     status: 'success',
//     data: null,
//   });
// });
// exports.createUser = (req, res) => {
//   res.status(500).json({
//     status: 500,
//     message: 'This route is currently unavailable',
//   });
// };

// exports.getUser = (req, res) => {
//   res.status(500).json({
//     status: 500,
//     message: 'This route is currently unavailable',
//   });
// };

// exports.updateUser = (req, res) => {
//   res.status(500).json({
//     status: 500,
//     message: 'This route is currently unavailable',
//   });
// };

// exports.deleteUser = (req, res) => {
//   res.status(500).json({
//     status: 500,
//     message: 'This route is currently unavailable',
//   });
// };
