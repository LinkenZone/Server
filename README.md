# Khi clone file về cần
B1: Dùng lệnh ```git branch <tên-nhánh-muốn-tạo>```

B2: Dùng lệnh ```git checkout <tên-nhánh-đã-tạo>```

# Cách chạy server
B1: Tải PostgreSQL về và tạo cơ sở dữ liệu tên là **LinkenZone**

B2: Đưa file config.env và .env vào

B3: Chỉnh lại biến môi trường trong file .env cho phù hợp với máy của mình

B4: chạy lệnh ```npm install```

B5: Chạy lệnh ```npx prisma migrate deploy```

B6: Chạy lệnh ```npm start``` để khởi động server 
# Cách upload lên github
B1: ```git add .```
B2: ```git commit -sm"<Thông-Điệp>"```
B3: ```git push orin <Tên-nhánh>```
