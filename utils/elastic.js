const { Client } = require('@elastic/elasticsearch');
const { comment } = require('./db');

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
        settings: {
          analysis: {
            analyzer: {
              prefix_search: {
                tokenizer: 'edge_ngram_tokenizer',
                filter: ['lowercase'],
              },
            },
            tokenizer: {
              edge_ngram_tokenizer: {
                type: 'edge_ngram',
                min_gram: 1,
                max_gram: 10,
                token_chars: ['letter', 'digit'],
              },
            },
          },
        },
        mappings: {
          properties: {
            document_id: { type: 'integer' },
            title: {
              type: 'text',
              analyzer: 'prefix_search',
              search_analyzer: 'standard',
            },
            description: {
              type: 'text',
              analyzer: 'prefix_search',
              search_analyzer: 'standard',
            },
            file_url: { type: 'keyword' },
            file_type: { type: 'keyword' },
            file_size: { type: 'long' },
            status: { type: 'keyword' },
            uploader_id: { type: 'integer' },
            subject_id: { type: 'integer' },
            lecturer_id: { type: 'integer' },
            uploaded_at: { type: 'date' },
            approved_at: { type: 'date' },
            is_deleted: { type: 'boolean' },
            deleted_at: { type: 'date' },
            is_starred: { type: 'boolean' },
            last_accessed: { type: 'date' },
            shared_with: { type: 'integer' },
            avgRating: { type: 'float' },
            commentCount: { type: 'integer' },
            uploader: {
              properties: {
                user_id: { type: 'integer' },
                full_name: {
                  type: 'text',
                  fields: { keyword: { type: 'keyword' } },
                },
                email: { type: 'keyword' },
              },
            },
            subject: {
              properties: {
                subject_id: { type: 'integer' },
                subject_name: {
                  type: 'text',
                  fields: { keyword: { type: 'keyword' } },
                },
                subject_code: { type: 'keyword' },
              },
            },
            lecturer: {
              properties: {
                lecturer_id: { type: 'integer' },
                lecturer_name: {
                  type: 'text',
                  fields: { keyword: { type: 'keyword' } },
                },
              },
            },
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
    file_size: Number(doc.file_size),
    status: doc.status,
    uploader_id: doc.uploader?.user_id,
    subject_id: doc.subject?.subject_id,
    lecturer_id: doc.lecturer?.lecturer_id,
    uploaded_at: doc.uploaded_at,
    approved_at: doc.approved_at,
    is_deleted: doc.is_deleted,
    deleted_at: doc.deleted_at,
    is_starred: doc.is_starred,
    last_accessed: doc.last_accessed,
    shared_with: doc.shared_with,
    avgRating: doc.avgRating,
    commentCount: doc.commentCount,
    uploader: doc.uploader
      ? {
          user_id: doc.uploader.user_id,
          full_name: doc.uploader.full_name,
          email: doc.uploader.email,
        }
      : null,
    subject: doc.subject
      ? {
          subject_id: doc.subject.subject_id,
          subject_name: doc.subject.subject_name,
          subject_code: doc.subject.subject_code,
        }
      : null,
    lecturer: doc.lecturer
      ? {
          lecturer_id: doc.lecturer.lecturer_id,
          lecturer_name: doc.lecturer.lecturer_name,
        }
      : null,
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
    file_size: Number(doc.file_size),
    status: doc.status,
    uploader_id: doc.uploader?.user_id,
    subject_id: doc.subject?.subject_id,
    lecturer_id: doc.lecturer?.lecturer_id,
    uploaded_at: doc.uploaded_at,
    approved_at: doc.approved_at,
    is_deleted: doc.is_deleted,
    deleted_at: doc.deleted_at,
    is_starred: doc.is_starred,
    last_accessed: doc.last_accessed,
    shared_with: doc.shared_with,
    avgRating: doc.avgRating,
    commentCount: doc.commentCount,
    uploader: doc.uploader
      ? {
          user_id: doc.uploader.user_id,
          full_name: doc.uploader.full_name,
          email: doc.uploader.email,
        }
      : null,
    subject: doc.subject
      ? {
          subject_id: doc.subject.subject_id,
          subject_name: doc.subject.subject_name,
          subject_code: doc.subject.subject_code,
        }
      : null,
    lecturer: doc.lecturer
      ? {
          lecturer_id: doc.lecturer.lecturer_id,
          lecturer_name: doc.lecturer.lecturer_name,
        }
      : null,
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
      min_score: 1,
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
            filter: [{ term: { is_deleted: false } }],
          },
        },
      },
    });
    return result.hits.hits.map((hit) => hit._source);
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
