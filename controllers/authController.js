const catchAsync = require('../utils/catchAsync');
const jwt = require('jsonwebtoken');
const appError = require('../utils/appError');
const { promisify } = require('util');
const crypto = require('crypto');
const userService = require('./../services/userService');
const prisma = require('../utils/db');
//=====================Phương thức bổ trợ====================
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSignToken = (user, statusCode, res) => {
  const token = signToken(user.user_id);
  const cookieOption = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') cookieOption.secure = true;
  res.cookie('jwt', token, cookieOption);
  //Xóa trước khi gửi về client
  user.password_hash = undefined;

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
  const { name, email, password, passwordConfirm, role } = req.body;

  // 1. Kiểm tra passwordConfirm
  if (password !== passwordConfirm) {
    return next(new appError('Mật khẩu không trùng khớp', 400));
  }

  // 2. Hash mật khẩu và tạo user bằng prisma
  const newUser = await userService.createUser({ name, email, password, role });
  // 3. Sinh token & trả về
  createSignToken(newUser, 201, res);
});

exports.signIn = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  //1. Kiểm tra email và password có tồn tại không
  if (!email || !password) {
    return next(new appError('Hãy nhập đủ email và mật khẩu', 400));
  }
  //2. Kiểm tra user có tồn tại và mật khẩu đúng hay không
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (
    !user ||
    !(await userService.correctPassword(password, user.password_hash))
  ) {
    return next(new appError('Email hoặc mật khẩu không đúng', 401));
  }
  //3. Nếu đúng thì gửi token về cho người dùng
  createSignToken(user, 200, res);
});

// Chưa test
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
  const freshUser = await prisma.user.findUnique({
    where: { user_id: Number(decoded.id) }, // Prisma: user_id là Int
  });

  if (!freshUser) {
    return next(new appError('Token vô hiệu!!!'), 401);
  }
  //4. Kiểm tra người dùng có thay đổi mật khẩu sau khi tạo ra JWT
  if (userService.changedPasswordAfter(freshUser, decoded.iat)) {
    return next(
      new appError('Người dùng đã thay đổi mật khẩu gần đây!!!', 401)
    );
  }
  console.log(freshUser);
  req.user = freshUser;
  next();
});

//Chưa test
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new appError('Bạn không có quyền để làm điều này', 403));
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1. Tìm user dựa trên email
  const user = await prisma.user.findUnique({
    where: { email: req.body.email },
  });

  if (!user) {
    return next(new appError('Không có người dùng với địa chỉ email này', 404));
  }

  // 2. Tạo token reset mật khẩu
  const resetToken = await userService.generateResetPasswordToken(user.user_id);

  // 3. Tạo URL reset password
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  //4. Gửi email (Bổ sung sau)
  res.status(202).json({
    status: 'success',
    resetToken,
  });
});

//Dùng khi người dùng không đăng nhập được
exports.resetPassword = catchAsync(async (req, res, next) => {
  //1. Lấy user dựa trên token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: {
        gt: new Date(), // so sánh thời gian hiện tại
      },
    },
  });
  //2. Nếu token chưa hết hạn và có user thì đặt mật khẩu mới
  if (!user) {
    return next(new appError('Token không đúng hoặc đã hết hiệu lực', 400));
  }

  //3. Cập nhật db
  const hashedPassword = await bcrypt.hash(req.body.password, 12);
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword, // nhớ hash trước khi lưu
      password_reset_token: null,
      password_reset_expires: null,
    },
  });
  //4. Gửi lại JWT cho user
  createSignToken(updatedUser, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //1. Xác thực user
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });
  //2. Xác thực password được gửi đến
  if (
    !(await userService.correctPassword(
      req.body.passwordCurrent,
      user.password
    ))
  ) {
    return next(new appError('Mật khẩu không trùng khớp', 401));
  }
  //3. Cập nhật mật khẩu
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: newHashedPassword,
      passwordChangedAt: new Date(), // nếu bạn có cột này để bảo mật JWT
    },
  });
  //4. Gửi lại JWT cho người dùng
  createSignToken(updatedUser, 200, res);
});
