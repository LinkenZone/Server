const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const reportService = require('../services/reports_service');

//Báo cáo tổng quan hệ thống
exports.getSystemOverview = catchAsync(async (req, res, next) => {
  const overview = await reportService.getSystemOverview();

  res.status(200).json({
    status: 'success',
    message: 'Lấy tổng quan hệ thống thành công',
    data: overview,
  });
});

//Báo cáo thống kê tài liệu
exports.getDocumentStatistics = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const stats = await reportService.getDocumentStatistics({
    startDate,
    endDate,
  });

  res.status(200).json({
    status: 'success',
    message: 'Lấy thống kê tài liệu thành công',
    data: stats,
  });
});

// Báo cáo người dùng đăng nhiều tài liệu nhất
exports.getTopUploaders = catchAsync(async (req, res, next) => {
  const limit = parseInt(req.query.limit) || 10;
  const topUploaders = await reportService.getTopUploaders(limit);

  res.status(200).json({
    status: 'success',
    message: 'Lấy top người đăng tải thành công',
    data: topUploaders,
  });
});

//Báo cáo thông kê người dùng theo thời gian lựa chọn
exports.getUserStatistics = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const stats = await reportService.getUserStatistics({
    startDate,
    endDate,
  });

  res.status(200).json({
    status: 'success',
    message: 'Lấy thống kê người dùng thành công',
    data: stats,
  });
});

//Báo cáo theo tuần và tháng
exports.getMonthlyReport = catchAsync(async (req, res, next) => {
  const year = parseInt(req.params.year) || new Date().getFullYear();
  const month = parseInt(req.params.month) || new Date().getMonth() + 1;

  if (month < 1 || month > 12) {
    return next(new AppError('Tháng phải từ 1 đến 12', 400));
  }

  const report = await reportService.getMonthlyReport(year, month);

  res.status(200).json({
    status: 'success',
    message: `Lấy báo cáo tháng ${month}/${year} thành công`,
    data: report,
  });
});

exports.getWeeklyReport = catchAsync(async (req, res, next) => {
  const report = await reportService.getWeeklyReport();

  res.status(200).json({
    status: 'success',
    message: 'Lấy báo cáo tuần thành công',
    data: report,
  });
});

exports.getReport = catchAsync(async (req, res, next) => {
  const report = await reportService.getDashboardReport();

  res.status(200).json({
    status: 'success',
    message: 'Lấy dữ liệu thành công',
    data: report,
  });
});

// Cập nhật dữ liệu dashboard report
exports.updateReport = catchAsync(async (req, res, next) => {
  const report = await reportService.updateDashboardReport(req.body);

  res.status(200).json({
    status: 'success',
    message: 'Cập nhật dữ liệu thành công',
    data: report,
  });
});

// Tăng số lượt truy cập (weekly_access) - Route public, không cần authentication
exports.incrementVisit = catchAsync(async (req, res, next) => {
  const report = await reportService.updateDashboardReport('weekly_access', 1);

  res.status(200).json({
    status: 'success',
    message: 'Đã ghi nhận lượt truy cập',
    data: {
      weekly_access: report.weekly_access,
    },
  });
});
