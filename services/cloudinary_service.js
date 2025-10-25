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

async function deleteFile(publicId, resourceType = 'raw') {
  try {
    // Xóa file trên Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true, // Xóa cache
    });

    console.log(`Deleted file from Cloudinary: ${publicId}`, result);
    return result;
  } catch (error) {
    console.error(`Error deleting file from Cloudinary: ${publicId}`, error);
    throw error;
  }
}

function extractPublicIdFromUrl(url) {
  try {
    if (!url) return null;

    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{version}/{public_id}.{extension}
    const urlParts = url.split('/upload/');
    if (urlParts.length < 2) return null;

    // Lấy phần sau '/upload/'
    const pathAfterUpload = urlParts[1];

    // Bỏ version (v1234567890)
    const pathWithoutVersion = pathAfterUpload.replace(/^v\d+\//, '');

    // Bỏ extension
    const publicId = pathWithoutVersion.replace(/\.[^.]+$/, '');

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

/**
 * Lấy secure URL để download file từ Cloudinary
 * @param {string} fileUrl - URL của file trên Cloudinary
 * @returns {string} Secure download URL
 */
function getSecureDownloadUrl(fileUrl) {
  try {
    if (!fileUrl) return null;

    // Lấy public_id từ URL
    const publicId = extractPublicIdFromUrl(fileUrl);
    if (!publicId) return fileUrl; // Fallback về URL gốc nếu không extract được

    // Xác định resource type từ URL
    let resourceType = 'raw';
    if (fileUrl.includes('/image/upload/')) {
      resourceType = 'image';
    } else if (fileUrl.includes('/video/upload/')) {
      resourceType = 'video';
    } else if (fileUrl.includes('/raw/upload/')) {
      resourceType = 'raw';
    }

    // Tạo secure URL mới (không force download, giữ nguyên để stream)
    const secureUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'upload',
      secure: true,
      sign_url: false, // Không cần sign vì chỉ cần access URL
    });

    return secureUrl;
  } catch (error) {
    console.error('Error getting secure download URL:', error);
    return fileUrl; // Fallback về URL gốc
  }
}

module.exports = {
  cloudinary,
  upload,
  deleteFileByUrl,
  getSecureDownloadUrl,
};
