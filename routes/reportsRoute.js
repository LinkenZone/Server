const express = require('express');
const reportsController = require('./../controllers/reportsController');
const authController = require('./../controllers/authController');

const router = express.Router();

// Route public - Tăng số lượt truy cập (không cần authentication)
router.post('/visit', reportsController.incrementVisit);

// Các routes sau đây yêu cầu authentication và admin role
router.use(authController.protect, authController.restrictTo('admin'));
router.get('/', reportsController.getReport);
router.patch('/reports/:id', reportsController.updateReport);
router.get('/statistics/overview', reportsController.getSystemOverview);
router.get('/statistics/users', reportsController.getUserStatistics);
router.get('/reports/monthly', reportsController.getMonthlyReport);
router.get('/reports/weekly', reportsController.getWeeklyReport);

module.exports = router;
