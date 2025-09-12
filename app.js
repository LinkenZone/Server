const express = require('express');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const app = express();
const hpp = require('hpp');
const authRoute = require('./routes/authRoute');
const documentRoute = require('./routes/documentRoute');
app.use(helmet());

//Đưa file tĩnh
app.use(express.static(`${__dirname}/public`));

//Giới hạn request - Sau khi xong BE sẽ uncomment phần này
// const limiter = rateLimit({
//   max: 100,
//   windowMs: 60 * 60 * 1000,
//   message: 'Đã đạt tới giới hạn request tối đa, hãy thử lại trong 1 giờ',
// });

// app.use('/api', limiter);
//========================

//Body parser and reading data into req.body
app.use(express.json({ limit: '100kb' }));

//Tránh ô nhiễm tham sô url - làm sau
// app.use(
//   hpp({
//     whitelist: [
//       'duration',
//       'ratingsQuantity',
//       'ratingAverage',
//       'maxGroupSize',
//       'difficulty',
//       'price',
//     ],
//   })
// );

//Middleware thêm thời gian request
app.use((req, res, next) => {
  req.requestedTime = new Date().toISOString();
  next();
});
//===============================================
// Ví dụ định nghĩa router
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/document', documentRoute);
// app.use('/api/v1/tours', tourRoute);
// app.use('/api/v1/users', userRoute);
// app.use('/api/v1/reviews', reviewRoute);

app.all('*', (req, res, next) => {
  next(new AppError(`Không tìm thấy ${req.originalUrl} trên máy chủ`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
