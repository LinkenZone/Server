const { Client } = require('@elastic/elasticsearch');

const elastic = new Client({ node: process.env.ELASTICSEARCH_URL });

// Khởi tạo index và mapping
async function initializeElasticsearch() {
  try {
    // Kiểm tra xem index đã tồn tại chưa
    const indexExists = await elastic.indices.exists({ index: 'documents' });

    if (indexExists) {
      // Xóa index cũ nếu đã tồn tại
      await elastic.indices.delete({ index: 'documents' });
    }

    // Tạo index mới với mapping
    await elastic.indices.create({
      index: 'documents',
      body: {
        mappings: {
          properties: {
            document_id: { type: 'integer' },
            title: { type: 'text', analyzer: 'standard' },
            description: { type: 'text', analyzer: 'standard' },
            file_url: { type: 'keyword' },
            file_type: { type: 'keyword' },
            status: { type: 'keyword' },
            is_deleted: { type: 'boolean' },
            uploader_name: { type: 'text', analyzer: 'standard' },
            subject_name: { type: 'text', analyzer: 'standard' },
            lecturer_name: { type: 'text', analyzer: 'standard' },
            uploaded_at: { type: 'date' },
          },
        },
      },
    });
    console.log('Elasticsearch index initialized successfully');
  } catch (error) {
    console.error('Error initializing Elasticsearch:', error);
    throw error;
  }
}
// Hàm để index một document
async function indexDocument(doc) {
  // Chuẩn bị dữ liệu cho Elasticsearch
  const esDoc = {
    document_id: doc.document_id,
    title: doc.title,
    description: doc.description,
    file_url: doc.file_url,
    file_type: doc.file_type,
    status: doc.status,
    is_deleted: doc.is_deleted,
    uploader_name: doc.uploader?.full_name,
    subject_name: doc.subject?.subject_name,
    lecturer_name: doc.lecturer?.lecturer_name,
    uploaded_at: doc.uploaded_at,
  };

  await elastic.index({
    index: 'documents',
    id: doc.document_id.toString(),
    body: esDoc,
  });
}
// Hàm để reindex toàn bộ dữ liệu từ database
async function reindexAllDocuments(prisma) {
  try {
    console.log('Bắt đầu reindex tất cả documents...');

    // Lấy tất cả documents từ database với thông tin liên quan
    const documents = await prisma.document.findMany({
      include: {
        uploader: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
          },
        },
        subject: {
          select: {
            subject_id: true,
            subject_name: true,
            subject_code: true,
          },
        },
        lecturer: {
          select: {
            lecturer_id: true,
            lecturer_name: true,
          },
        },
      },
    });

    console.log(`Tìm thấy ${documents.length} documents để reindex`);

    // Khởi tạo lại index
    await initializeElasticsearch();

    // Index từng document
    let successCount = 0;
    let errorCount = 0;

    for (const doc of documents) {
      try {
        await indexDocument(doc);
        successCount++;
        if (successCount % 100 === 0) {
          console.log(`Đã xử lý ${successCount}/${documents.length} documents`);
        }
      } catch (error) {
        console.error(`Lỗi khi index document ${doc.document_id}:`, error);
        errorCount++;
      }
    }

    console.log('Kết thúc reindex:');
    console.log(`- Thành công: ${successCount} documents`);
    console.log(`- Thất bại: ${errorCount} documents`);

    return { successCount, errorCount };
  } catch (error) {
    console.error('Lỗi trong quá trình reindex:', error);
    throw error;
  }
}

async function updateES(doc) {
  // Chuẩn bị dữ liệu cho Elasticsearch
  const esDoc = {
    document_id: doc.document_id,
    title: doc.title,
    description: doc.description,
    file_url: doc.file_url,
    file_type: doc.file_type,
    status: doc.status,
    is_deleted: doc.is_deleted,
    uploader_name: doc.uploader?.full_name,
    subject_name: doc.subject?.subject_name,
    lecturer_name: doc.lecturer?.lecturer_name,
    uploaded_at: doc.uploaded_at,
  };

  await elastic.update({
    index: 'documents',
    id: doc.document_id.toString(),
    body: {
      doc: esDoc,
    },
  });
}

async function deleteES(docId, hardDelete = false) {
  if (hardDelete) {
    // Nếu xóa hẳn thì remove luôn trong Elasticsearch
    await elastic.delete({
      index: 'documents',
      id: docId.toString(),
    });
  } else {
    // Nếu chỉ xoá mềm thì update lại flag trong Elasticsearch
    await elastic.update({
      index: 'documents',
      id: docId.toString(),
      doc: { is_deleted: true },
    });
  }
}

async function search(q) {
  try {
    const result = await elastic.search({
      index: 'documents',
      body: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: q,
                  fields: [
                    'title^3',
                    'description^2',
                    'uploader_name',
                    'subject_name',
                    'lecturer_name',
                  ],
                  fuzziness: 'AUTO',
                },
              },
            ],
            filter: [
              { term: { is_deleted: false } },
              { term: { status: 'approved' } },
            ],
          },
        },
        sort: [{ uploaded_at: { order: 'desc' } }],
      },
    });
    return result.hits.hits;
  } catch (error) {
    console.error('Elasticsearch search error:', error);
    throw error;
  }
}

module.exports = {
  elastic,
  reindexAllDocuments,
  indexDocument,
  updateES,
  deleteES,
  search,
};
