const express = require('express');
const authController = require('./../controllers/authController');

const router = express.Router();

router.post('/register', authController.signUp);
router.post('/login', authController.signIn);
router.post('/forgetpassword', authController.forgotPassword);
router.patch('/resetpassword/:token', authController.resetPassword);
router.patch(
  '/updatepassword',
  authController.protect,
  authController.updatePassword
);

module.exports = router;
