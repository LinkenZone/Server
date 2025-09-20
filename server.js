//=================Gọi các module=======================
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });
const app = require('./app');
const prisma = require('./utils/db');
const elastic = require('./utils/elastic');
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
//Khởi tạo index trong Elasticsearch nếu chưa có
async function initES() {
  const exists = await elastic.indices.exists({ index: 'documents' });
  if (exists) {
    console.log('Index documents đã tồn tại');
    return;
  }

  await elastic.indices.create({
    index: 'documents',
    body: {
      mappings: {
        properties: {
          title: { type: 'text' },
          description: { type: 'text' },
          file_url: { type: 'keyword' },
          file_type: { type: 'keyword' },
          uploader_id: { type: 'integer' },
          uploader_name: { type: 'text' },
          uploader_email: { type: 'keyword' },
          subject_id: { type: 'integer' },
          lecturer_id: { type: 'integer' },
          status: { type: 'keyword' },
          created_at: { type: 'date' },
        },
      },
    },
  });
  console.log('Index documents đã được tạo');
}
initES();
//===================
//Chạy server
const server = app.listen(process.env.PORT, () => {
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
