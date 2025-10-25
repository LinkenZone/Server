const express = require('express');
const userController = require('./../controllers/userController');
const authController = require('./../controllers/authController');

const router = express.Router();

// All user management routes require authentication and admin role
router.use(authController.protect);
router.use(authController.restrictTo('admin'));

// ==================== USER MANAGEMENT ====================
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserDetails);
router.patch('/:id/role', userController.changeUserRole);
router.patch('/:id/ban', userController.banUser);
router.patch('/:id/unban', userController.unbanUser);
router.delete('/:id', userController.deleteUser); // Xóa mềm

module.exports = router;
