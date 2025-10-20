const express = require('express');
const reportsController = require('./../controllers/reportsController');
const authController = require('./../controllers/authController');

const router = express.Router();

router.patch(
    '/reports/:id',
    authController.protect,
    authController.restrictTo('admin'),
    reportsController.updateReport
);
// Tất cả routes báo cáo đều cần authentication và admin role
router.get('/statistics/overview', authController.protect, authController.restrictTo('admin'), reportsController.getSystemOverview);
router.get('/statistics/users', authController.protect, authController.restrictTo('admin'), reportsController.getUserStatistics);
router.get('/reports/monthly', authController.protect, authController.restrictTo('admin'), reportsController.getMonthlyReport);
router.get('/reports/weekly', authController.protect, authController.restrictTo('admin'), reportsController.getWeeklyReport());

module.exports = router;