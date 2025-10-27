//=================Gọi các module=======================
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });
dotenv.config({ path: './.env' });
const app = require('./app');
const prisma = require('./utils/db');
const { elastic, reindexAllDocuments } = require('./utils/elastic');
const { scheduleDeleteOldFiles } = require('./utils/schedule');
const https = require('https');
const http = require('http');
const fs = require('fs');
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
let server;

if(process.env.NODE_ENV === 'production'){
  const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/api.nguyentronghieu.io.vn/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/api.nguyentronghieu.io.vn/fullchain.pem')
  };

  server = https.createServer(options, app).listen(443, '0.0.0.0', () => {
    console.log('✅ HTTPS Server đang chạy trên cổng 443');
  });
} else {
  server = http.createServer(app).listen(process.env.PORT, '0.0.0.0', () => {
    console.log(`HTTP Server đang chạy trên cổng ${process.env.PORT}...`);
  });
}
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
