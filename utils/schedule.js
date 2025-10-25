const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { deleteFileByUrl } = require('../services/cloudinary_service');

const prisma = new PrismaClient();

const scheduleDeleteOldFiles = () => {
  // Cron syntax: second minute hour day month dayOfWeek
  // '0 2 * * *' = Chạy lúc 2:00 AM mỗi ngày
  cron.schedule('0 2 * * *', async () => {
    try {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const documentsToDelete = await prisma.document.findMany({
        where: {
          is_deleted: true,
          deleted_at: {
            lte: fifteenDaysAgo,
          },
        },
        select: {
          document_id: true,
          title: true,
          file_url: true,
          deleted_at: true,
        },
      });

      if (documentsToDelete.length === 0) {
        return;
      }
      // Xóa từng file trên Cloudinary và xóa record trong database
      for (const document of documentsToDelete) {
        try {
          // Xóa file trên Cloudinary
          await deleteFileByUrl(document.file_url);
          // Xóa record trong database
          await prisma.document.delete({
            where: {
              document_id: document.document_id,
            },
          });
        } catch (error) {
          console.error(
            `[CRON] Error deleting document #${document.document_id}:`,
            error.message
          );
          continue;
        }
      }
    } catch (error) {
      console.error('[CRON] Error in scheduled task:', error);
    }
  });
};

module.exports = {
  scheduleDeleteOldFiles,
};
