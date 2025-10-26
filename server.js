//=================Gọi các module=======================
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });
const app = require('./app');
const prisma = require('./utils/db');
const { elastic, reindexAllDocuments } = require('./utils/elastic');
const { scheduleDeleteOldFiles } = require('./utils/schedule');
//======================================================

//Kết nối PostgreSQL
async function connectDB() {
  try {
    await prisma.$connect();
    console.log('✅ Kết nối Prisma (PostgreSQL) thành công');
  } catch (err) {
    console.error('❌ Lỗi kết nối Prisma:', err);
    process.exit(1);
  }
}
connectDB();
//Kết nối Elasticsearch
async function connectElastic() {
  try {
    await elastic.ping();
    console.log('✅ Kết nối Elasticsearch thành công');
  } catch (err) {
    console.error('❌ Lỗi kết nối Elasticsearch:', err);
    process.exit(1);
  }
}
connectElastic();
// Chạy reindex tất cả document lên Elasticsearch
reindexAllDocuments(prisma);
//===================
// Khởi động scheduled tasks
scheduleDeleteOldFiles();
console.log('✅ Scheduled tasks initialized');
//===================
//Chạy server
const server = app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Ứng dụng đang chạy trên cổng ${process.env.PORT}...`);
});
//============
//==================Xử lý có lỗi khi chạy ứng dụng thì ngừng ngay server==================
process.on('unhandledRejection', (err) => {
  console.log('🚨 LỖI KHÔNG XỬ LÝ:', err.name, err.message);
  console.log('Đang tắt ứng dụng...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.log('🚨 NGOẠI LỆ KHÔNG ĐƯỢC BẮT:', err.name, err.message);
  console.log('Đang tắt ứng dụng...');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('💀 SIGTERM received. Shutting down gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('💥 Process terminated!');
  });
});
//========================================================================================
