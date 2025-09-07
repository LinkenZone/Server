const User = require('../Models/userModel');
const catchAsync = require('../utils/catchAsync');
const jwt = require('jsonwebtoken');
const appError = require('../utils/appError');
const { promisify } = require('util');
const crypto = require('crypto');

//=====================Phương thức bổ trợ====================
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSignToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOption = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') cookieOption.secure = true;
  res.cookie('jwt', token, cookieOption);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};
//===========================================================
exports.signUp = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role,
    passwordChangedAt: req.body.passwordChangedAt,
  });

  createSignToken(newUser, 201, res);
});

exports.signIn = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  //1. Kiểm tra email và password có tồn tại không
  if (!email || !password) {
    return next(new appError('Hãy nhập đủ email và mật khẩu', 400));
  }
  //2. Kiểm tra user có tồn tại và mật khẩu đúng hay không
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new appError('Email hoặc mật khẩu không đúng', 401));
  }
  //3. Nếu đúng thì gửi token về cho người dùng
  createSignToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  //1. Lấy token
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new appError('Bạn chưa đăng nhập!!!', 401));
  }
  //2. Xác thực token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  //3. Xác thực người dùng
  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(
      new appError('Token belonging to this user is invalid!!!'),
      401
    );
  }
  //4. Kiểm tra người dùng có thay đổi mật khẩu sau khi tạo ra JWT
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new appError('Người dùng đã thay đổi mật khẩu gần đây!!!', 401)
    );
  }
  console.log(freshUser);
  req.user = freshUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new appError('Bạn không có quyền để làm điều này', 403));
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1. Tìm người dùng dựa trên email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('Không có người dùng với địa chỉ email này', 404));
  }

  // 2. Tạo token đặt lại mật khẩu
  const resetToken = user.generateResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // 3. Tạo URL đặt lại mật khẩu
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;
  console.log(resetToken);
  // 4. Tạo nội dung email
  const message = `Quên mật khẩu? Gửi yêu cầu PATCH với mật khẩu mới và xác nhận mật khẩu đến: ${resetURL}.\nNếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.`;

  // 5. Gửi email
  try {
    await sendEmail({
      email: user.email,
      subject: 'Token đặt lại mật khẩu (có hiệu lực trong 10 phút)',
      message,
    });

    // 6. Gửi phản hồi thành công
    res.status(200).json({
      status: 'success',
      message: 'Token đã được gửi đến email',
    });
  } catch (err) {
    // Xử lý lỗi: Xóa token và thời gian hết hạn nếu gửi email thất bại
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('Có lỗi khi gửi email. Vui lòng thử lại sau.', 500)
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  //1. Lấy user dựa trên token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  //2. Nếu token chưa hết hạn và có user thì đặt mật khẩu mới
  if (!user) {
    return next(new appError('Token không đúng hoặc đã hết hiệu lực', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  //3. Cập nhật db
  //4. Gửi lại JWT cho user
  createSignToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //1. Xác thực user
  const user = await User.findById(req.user._id).select('+password');
  //2. Xác thực password được gửi đến
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new appError('Mật khẩu không trùng khớp', 401));
  }
  //3. Cập nhật mật khẩu
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  //4. Gửi lại JWT cho người dùng
  createSignToken(user, 200, res);
});
