const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  //Cấu hình cloudinary
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// cấu hình storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'linkenzone_uploads', // tên folder trên Cloudinary
    resource_type: 'auto', // cho phép pdf, docx, image...
  },
});

const upload = multer({ storage });

module.exports = { cloudinary, upload };
