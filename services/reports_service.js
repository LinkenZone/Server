const prisma = require('../utils/db');

//Lấy báo cáo thống kê tài liệu theo thời gian lựa chọn
async function getDocumentStatistics(timeFilter = {}) {
  const { startDate, endDate } = timeFilter;

  const whereClause = {};
  if (startDate && endDate) {
    whereClause.uploaded_at = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  return {
    totalDocuments: await prisma.document.count({ where: whereClause }),
    pendingDocuments: await prisma.document.count({
      where: { ...whereClause, status: 'pending' },
    }),
    approvedDocuments: await prisma.document.count({
      where: { ...whereClause, status: 'approved' },
    }),
    rejectedDocuments: await prisma.document.count({
      where: { ...whereClause, status: 'rejected' },
    }),
    deletedDocuments: await prisma.document.count({
      where: { ...whereClause, is_deleted: true },
    }),
  };
}

//Lấy thông tin báo cáo người đăng nhiều bài nhất
async function getTopUploaders(limit = 10) {
  return prisma.user.findMany({
    select: {
      user_id: true,
      full_name: true,
      email: true,
      _count: {
        select: { uploaded_documents: true },
      },
    },
    orderBy: {
      uploaded_documents: { _count: 'desc' },
    },
    take: limit,
  });
}

// Lấy báo cáo thống kê người dùng theo thời gian lựa chọn
async function getUserStatistics(timeFilter = {}) {
  const { startDate, endDate } = timeFilter;

  const whereClause = {};
  if (startDate && endDate) {
    whereClause.created_at = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  return {
    totalUsers: await prisma.user.count({ where: whereClause }),
    activeUsers: await prisma.user.count({
      where: { ...whereClause, role: 'user' },
    }),
    bannedUsers: await prisma.user.count({
      where: { ...whereClause, is_banned: true },
    }),
    admins: await prisma.user.count({
      where: { ...whereClause, role: 'admin' },
    }),
  };
}

// Lấy báo cáo tổng quan hệ thống
async function getSystemOverview() {
  const [docStats, userStats, recentActivity] = await Promise.all([
    getDocumentStatistics(),
    getUserStatistics(),
    getRecentActivity(),
  ]);

  return {
    documents: docStats,
    users: userStats,
    recentActivity,
    systemHealth: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date(),
    },
  };
}

// Lấy hoạt động gần đây nhất
async function getRecentActivity(limit = 20) {
  const recentDocs = await prisma.document.findMany({
    select: {
      document_id: true,
      title: true,
      status: true,
      uploaded_at: true,
      uploader: {
        select: { full_name: true },
      },
    },
    orderBy: { uploaded_at: 'desc' },
    take: limit,
  });

  return recentDocs.map((doc) => ({
    type: 'document_upload',
    message: `${doc.uploader.full_name} uploaded "${doc.title}"`,
    status: doc.status,
    timestamp: doc.uploaded_at,
  }));
}

// Lấy báo cáo hàng tháng
async function getMonthlyReport(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const [docStats, userStats] = await Promise.all([
    getDocumentStatistics({ startDate, endDate }),
    getUserStatistics({ startDate, endDate }),
  ]);

  return {
    period: { year, month, startDate, endDate },
    documents: docStats,
    users: userStats,
    growth: await calculateGrowthRate(startDate, endDate),
  };
}

// Lấy báo cáo hàng tuần
async function getWeeklyReport() {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  return getMonthlyReport(startDate.getFullYear(), startDate.getMonth() + 1);
}

// Tính tỷ lệ tăng trưởng
async function calculateGrowthRate(startDate, endDate) {
  // Tính growth rate so với period trước đó
  const prevStartDate = new Date(
    startDate.getTime() - (endDate.getTime() - startDate.getTime())
  );

  const [currentPeriod, previousPeriod] = await Promise.all([
    getDocumentStatistics({ startDate, endDate }),
    getDocumentStatistics({ startDate: prevStartDate, endDate: startDate }),
  ]);

  return {
    documents: {
      current: currentPeriod.totalDocuments,
      previous: previousPeriod.totalDocuments,
      growth:
        ((currentPeriod.totalDocuments - previousPeriod.totalDocuments) /
          (previousPeriod.totalDocuments || 1)) *
        100,
    },
  };
}

// Lấy dữ liệu dashboard từ bảng Report
async function getDashboardReport() {
  let report = await prisma.report.findFirst({
    orderBy: { report_id: 'asc' },
  });

  if (!report) {
    report = await prisma.report.create({
      data: {
        today_upload: 0,
        today_new_user: 0,
        weekly_access: 0,
        total_download: 0,
      },
    });
  }

  // Tính toán các thông số động từ database
  const [pendingDocs, totalFiles, totalAccounts, totalComments] =
    await Promise.all([
      // Tổng số tài liệu chờ duyệt
      prisma.document.count({
        where: { status: 'pending', is_deleted: false },
      }),
      // Tổng số file trong hệ thống (không bao gồm file đã xóa)
      prisma.document.count({
        where: { is_deleted: false },
      }),
      // Tổng số tài khoản
      prisma.user.count(),
      // Tổng số bình luận
      prisma.comment.count(),
    ]);
  // Trả về report với các thông số được tính động
  return {
    ...report,
    pendingDocs,
    total_files: totalFiles,
    total_accounts: totalAccounts,
    total_comments: totalComments,
  };
}

async function updateDashboardReport(fieldName, incrementBy = 1) {
  // Đảm bảo có ít nhất 1 record trong bảng Report
  const existingReport = await prisma.report.findFirst();

  if (!existingReport) {
    return prisma.report.create({
      data: {
        today_upload: fieldName === 'today_upload' ? incrementBy : 0,
        today_new_user: fieldName === 'today_new_user' ? incrementBy : 0,
        weekly_access: fieldName === 'weekly_access' ? incrementBy : 0,
        total_download: fieldName === 'total_download' ? incrementBy : 0,
      },
    });
  }

  return prisma.report.update({
    where: { report_id: existingReport.report_id },
    data: {
      [fieldName]: { increment: incrementBy },
      updated_at: new Date(),
    },
  });
}

module.exports = {
  getDocumentStatistics,
  getTopUploaders,
  getUserStatistics,
  getSystemOverview,
  getRecentActivity,
  getMonthlyReport,
  getWeeklyReport,
  calculateGrowthRate,
  getDashboardReport,
  updateDashboardReport,
};
