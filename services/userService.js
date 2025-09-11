const prisma = require('../utils/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
//======================================
async function createUser(data) {
  const hashedPassword = await bcrypt.hash(data.password, 12);
  return prisma.user.create({
    data: {
      full_name: data.name,
      email: data.email,
      password_hash: hashedPassword,
      role: data.role || 'user',
    },
  });
}

async function findUserByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

async function correctPassword(candidatePassword, userPasswordHash) {
  return bcrypt.compare(candidatePassword, userPasswordHash);
}

function changedPasswordAfter(user, JWTTimestamp) {
  if (user.password_changed_at) {
    const changedTimestamp = parseInt(
      user.password_changed_at.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
}

async function generateResetPasswordToken(userId) {
  // 1. Tạo token gốc (người dùng sẽ nhận)
  const resetToken = crypto.randomBytes(32).toString('hex');
  // 2. Hash token để lưu trong DB
  const passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // 3. Set thời gian hết hạn (10 phút)
  const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
  // 4. Update vào DB
  await prisma.user.update({
    where: { user_id: userId },
    data: {
      password_reset_token: passwordResetToken,
      password_reset_expires: passwordResetExpires,
    },
  });
  // 5. Trả về token gốc (gửi email cho user)
  return resetToken;
}

module.exports = {
  createUser,
  findUserByEmail,
  correctPassword,
  changedPasswordAfter,
  generateResetPasswordToken,
};
