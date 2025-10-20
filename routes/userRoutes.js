const express = require('express');
const userController = require('./../controllers/userController');
const authController = require('./../controllers/authController');

const router = express.Router();

// All user management routes require authentication and admin role
router.use(authController.protect);
router.use(authController.restrictTo('admin'));

// ==================== USER MANAGEMENT ====================
router.get('/users', userController.getAllUsers);
router.get('/users/:id', userController.getUserDetails);
router.patch('/users/:id/ban', userController.banUser);
router.patch('/users/:id/unban', userController.unbanUser);
router.delete('/users/:id', userController.deleteUser); // Xóa mềm

module.exports = router;
