const express = require('express');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const app = express();
const hpp = require('hpp');
const authRoute = require('./routes/authRoute');
const documentRoute = require('./routes/documentRoute');
const adminRoute = require('./routes/adminRoute');
const userRoute = require('./routes/userRoute');
const cors = require('cors');

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// CORS Configuration - Allow frontend domain
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin){
	console.log("Đã chạy tới !origin");
	return callback(null, true);
      } 
      if (allowedOrigins.indexOf(origin) !== -1) {
	console.log("Đã chạy tới bước 2");
        callback(null, true);
      } else {
	console.log("Đã chạy tới bước 3");
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(helmet());

app.use(hpp());

//Đưa file tĩnh
app.use(express.static(`${__dirname}/public`));

const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Đã đạt tới giới hạn request tối đa, hãy thử lại trong 1 giờ',
});

app.use('/api', limiter);
//========================

//Body parser and reading data into req.body
app.use(express.json({ limit: '100kb' }));

//Middleware thêm thời gian request
app.use((req, res, next) => {
  req.requestedTime = new Date().toISOString();
  next();
});
//===============================================
// Định nghĩa router
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/document', documentRoute);
app.use('/api/v1/admin', adminRoute);
app.use('/api/v1/users', userRoute);


app.all('*', (req, res, next) => {
  next(new AppError(`Không tìm thấy ${req.originalUrl} trên máy chủ`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
