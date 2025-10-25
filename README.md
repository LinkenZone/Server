# LinkenZone Backend API

Backend API cho ứng dụng LinkenZone - Hệ thống quản lý và chia sẻ tài liệu.

## 🚀 Công nghệ sử dụng

- **Node.js & Express** - Backend framework
- **PostgreSQL** - Database (qua Prisma ORM)
- **Elasticsearch** - Full-text search engine
- **Cloudinary** - Cloud storage cho files
- **JWT** - Authentication
- **PM2** - Process manager (production)

## 📋 Yêu cầu hệ thống

- Node.js v18 trở lên
- PostgreSQL v14 trở lên
- Elasticsearch v8.x (optional, có thể chạy sau)

## ⚙️ Cài đặt Development

### 1. Clone project và tạo branch

```bash
# Clone project
git clone <repo-url>
cd Server

# Tạo branch mới
git branch <tên-nhánh-muốn-tạo>
git checkout <tên-nhánh-đã-tạo>

# Install dependencies
npm install
```

### 2. Cấu hình Environment Variables

```bash
# Copy file mẫu
cp config.env.example config.env

# Chỉnh sửa config.env với thông tin của bạn
```

### 3. Setup Database

```bash
# Tạo database PostgreSQL tên "LinkenZone"

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# (Optional) Open Prisma Studio
npx prisma studio
```

### 4. Chạy Development Server

```bash
npm run dev
```

Server sẽ chạy tại: `http://localhost:5000`

## 🌐 Production Deployment

Xem hướng dẫn chi tiết tại: **[VPS_DEPLOYMENT.md](./VPS_DEPLOYMENT.md)**

### Quick Start Production

```bash
# Install dependencies
npm install --production

# Setup database
npx prisma generate
npx prisma migrate deploy

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 📁 Cấu trúc Project

```
Server/
├── controllers/        # Controllers xử lý logic
├── routes/            # API routes
├── services/          # Business logic layer
├── utils/             # Utilities & helpers
├── prisma/            # Database schema & migrations
├── public/            # Static files
├── app.js             # Express app configuration
├── server.js          # Server entry point
├── ecosystem.config.js # PM2 configuration
└── nginx.conf         # Nginx configuration example
```

## 🔌 API Endpoints

### Health Check

- `GET /health` - Health check endpoint

### Authentication

- `POST /api/v1/auth/register` - Đăng ký user
- `POST /api/v1/auth/login` - Đăng nhập
- `GET /api/v1/auth/logout` - Đăng xuất

### Documents

- `GET /api/v1/document` - Lấy danh sách documents
- `POST /api/v1/document` - Tạo document mới
- `GET /api/v1/document/:id` - Lấy chi tiết document
- `PATCH /api/v1/document/:id` - Cập nhật document
- `DELETE /api/v1/document/:id` - Xóa document
- `GET /api/v1/document/search` - Tìm kiếm documents

### Admin

- `GET /api/v1/admin/users` - Quản lý users
- `GET /api/v1/admin/stats` - Thống kê

## 🔒 Environment Variables

Xem file `config.env.example` để biết các biến cần thiết:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT secret key
- `JWT_EXPIRES_IN` - JWT expiration time
- `CLOUD_NAME`, `API_KEY`, `API_SECRET` - Cloudinary credentials
- `ELASTICSEARCH_URL` - Elasticsearch URL
- `FRONTEND_URL` - Frontend domain (for CORS)

## 🛠️ Scripts

```bash
npm run dev          # Chạy development server với nodemon
npm start            # Chạy production server
npm run prisma:generate   # Generate Prisma Client
npm run prisma:migrate    # Deploy migrations
npm run prisma:studio     # Open Prisma Studio
```

## 🔧 PM2 Commands (Production)

```bash
pm2 start ecosystem.config.js  # Start app
pm2 logs linkenzone-api       # View logs
pm2 restart linkenzone-api    # Restart app
pm2 stop linkenzone-api       # Stop app
pm2 monit                     # Monitor
```

## 📤 Upload lên GitHub

```bash
git add .
git commit -sm"<Thông-Điệp>"
git push origin <Tên-nhánh>
```

## 🐛 Troubleshooting

### Lỗi kết nối Database

```bash
# Kiểm tra PostgreSQL đang chạy
sudo systemctl status postgresql

# Kiểm tra connection string trong config.env
```

### Lỗi kết nối Elasticsearch

```bash
# Kiểm tra Elasticsearch đang chạy
curl http://localhost:9200

# Hoặc disable Elasticsearch trong development (comment code)
```

### Lỗi Prisma

```bash
# Regenerate Prisma Client
npx prisma generate

# Reset database (WARNING: mất dữ liệu)
npx prisma migrate reset
```

## 📝 License

ISC
