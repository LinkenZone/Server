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
  params: async (req, file) => {
    const mimetype = (file.mimetype || '').toLowerCase();
    const ext = (file.originalname || '').split('.').pop().toLowerCase();

    let resource_type = 'raw';
    if (mimetype.startsWith('image/')) resource_type = 'image';
    else if (mimetype.startsWith('video/')) resource_type = 'video';

    const publicId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return {
      folder: 'linkenzone_uploads',
      resource_type,
      public_id: resource_type === 'raw' ? `${publicId}.${ext}` : publicId,
    };
  },
});

const upload = multer({ storage });

async function deleteFile(publicId, resourceType = 'raw') {
  try {
    // Xóa file trên Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true, // Xóa cache
    });
    return result;
  } catch (error) {
    console.error(`Error deleting file from Cloudinary: ${publicId}`, error);
    throw error;
  }
}

function extractPublicIdFromUrl(url) {
  try {
    if (!url) {
      console.error('extractPublicIdFromUrl: URL is null or undefined');
      return null;
    }

    console.log('Extracting publicId from URL:', url);

    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{version}/{public_id}.{extension}
    const urlParts = url.split('/upload/');
    if (urlParts.length < 2) {
      console.error('extractPublicIdFromUrl: URL does not contain /upload/');
      return null;
    }

    // Lấy phần sau '/upload/'
    let pathAfterUpload = urlParts[1];

    // Bỏ version (v1234567890) nếu có
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');

    // Bỏ extension (phần cuối cùng sau dấu chấm)
    const publicId = pathAfterUpload.replace(/\.[^/.]+$/, '');

    console.log('Extracted publicId:', publicId);
    return publicId;
  } catch (error) {
    console.error('Error extracting public_id from URL:', error);
    return null;
  }
}

async function deleteFileByUrl(fileUrl) {
  try {
    const publicId = extractPublicIdFromUrl(fileUrl);

    if (!publicId) {
      throw new Error('Không thể extract public_id từ URL');
    }

    const resourceTypes = ['raw', 'image', 'video', 'auto'];

    for (const resourceType of resourceTypes) {
      try {
        const result = await deleteFile(publicId, resourceType);
        if (result.result === 'ok') {
          console.log(
            `Successfully deleted file with resource_type: ${resourceType}`
          );
          return result;
        }
      } catch {
        // Thử resource type tiếp theo
        continue;
      }
    }

    throw new Error('Không thể xóa file với bất kỳ resource_type nào');
  } catch (error) {
    console.error('Error deleting file by URL:', error);
    throw error;
  }
}

module.exports = {
  cloudinary,
  upload,
  deleteFileByUrl,
  extractPublicIdFromUrl,
};
