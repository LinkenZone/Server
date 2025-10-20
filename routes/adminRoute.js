const express = require('express');
const authController = require('./../controllers/authController');
const adminController = require('./../controllers/adminController');

const router = express.Router();

// Tất cả admin routes đều cần authentication và admin role
router.use(authController.protect);
router.use(authController.restrictTo('admin'));

// ==================== USER MANAGEMENT ====================
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserDetails);
router.patch('/users/:id/ban', adminController.banUser);
router.patch('/users/:id/unban', adminController.unbanUser);
router.delete('/users/:id', adminController.deleteUser);//Xóa mềm

// ==================== DOCUMENT MANAGEMENT ====================
// Xong router.patch('/documents/:id/reject', adminController.rejectDocument);

// ==================== SUBJECT & LECTURER MANAGEMENT ====================
router.post('/subjects', adminController.createSubject);
router.patch('/subjects/:id', adminController.updateSubject);
router.delete('/subjects/:id', adminController.deleteSubject);

router.post('/lecturers', adminController.createLecturer);//Cập nhật lại schema.prisma của Lecturer BỔ SUNG THÊM NHỮNG CÁI THÊM VÀO
// router.delete('/lecturers/:id', adminController.deleteLecturer);

module.exports = router;
