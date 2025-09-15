# Elasticsearch Integration Guide

## 📋 Hướng dẫn tích hợp Elasticsearch cho tìm kiếm Documents

### 🔧 Cấu trúc hiện tại đã chuẩn bị sẵn

File `documentController.js` đã được chuẩn bị với:

- ✅ Placeholder cho Elasticsearch integration
- ✅ Logic xử lý riêng biệt cho search và non-search
- ✅ Response format nhất quán
- ✅ Error handling sẵn có

## 🚀 Bước 1: Cài đặt Dependencies

```bash
npm install @elastic/elasticsearch
```

## 📁 Bước 2: Tạo Elasticsearch Service

Tạo file `services/elasticsearchService.js`:

```javascript
const { Client } = require('@elastic/elasticsearch');

class ElasticsearchService {
  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    });
    this.indexName = 'documents';
  }

  // Tạo index và mapping
  async createIndex() {
    const indexExists = await this.client.indices.exists({
      index: this.indexName,
    });

    if (!indexExists.body) {
      await this.client.indices.create({
        index: this.indexName,
        body: {
          mappings: {
            properties: {
              document_id: { type: 'integer' },
              title: {
                type: 'text',
                analyzer: 'standard',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              description: { type: 'text' },
              file_type: { type: 'keyword' },
              status: { type: 'keyword' },
              uploader_id: { type: 'integer' },
              subject_id: { type: 'integer' },
              lecturer_id: { type: 'integer' },
              uploaded_at: { type: 'date' },
              subject_name: { type: 'text' },
              subject_code: { type: 'keyword' },
              lecturer_name: { type: 'text' },
            },
          },
        },
      });
    }
  }

  // Index một document
  async indexDocument(document) {
    return await this.client.index({
      index: this.indexName,
      id: document.document_id,
      body: {
        document_id: document.document_id,
        title: document.title,
        description: document.description,
        file_type: document.file_type,
        status: document.status,
        uploader_id: document.uploader_id,
        subject_id: document.subject_id,
        lecturer_id: document.lecturer_id,
        uploaded_at: document.uploaded_at,
        subject_name: document.subject?.subject_name,
        subject_code: document.subject?.subject_code,
        lecturer_name: document.lecturer?.lecturer_name,
      },
    });
  }

  // Tìm kiếm documents của user
  async searchUserDocuments({ userId, query, status, page = 1, limit = 10 }) {
    const must = [{ term: { uploader_id: userId } }];

    // Thêm điều kiện search
    if (query && query.trim()) {
      must.push({
        multi_match: {
          query: query.trim(),
          fields: [
            'title^3', // Boost title cao nhất
            'description^2', // Boost description vừa
            'subject_name^2', // Boost subject name vừa
            'lecturer_name^1.5', // Boost lecturer name thấp hơn
            'subject_code^1.5', // Boost subject code thấp hơn
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Thêm filter theo status
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      must.push({ term: { status } });
    }

    const searchBody = {
      query: {
        bool: { must },
      },
      sort: [{ uploaded_at: { order: 'desc' } }],
      from: (page - 1) * limit,
      size: limit,
    };

    const response = await this.client.search({
      index: this.indexName,
      body: searchBody,
    });

    return {
      documents: response.body.hits.hits.map((hit) => ({
        document_id: hit._source.document_id,
        title: hit._source.title,
        description: hit._source.description,
        file_type: hit._source.file_type,
        status: hit._source.status,
        uploader_id: hit._source.uploader_id,
        subject_id: hit._source.subject_id,
        lecturer_id: hit._source.lecturer_id,
        uploaded_at: hit._source.uploaded_at,
        subject: {
          subject_id: hit._source.subject_id,
          subject_name: hit._source.subject_name,
          subject_code: hit._source.subject_code,
        },
        lecturer: {
          lecturer_id: hit._source.lecturer_id,
          lecturer_name: hit._source.lecturer_name,
        },
        _score: hit._score, // Điểm relevance
      })),
      total: response.body.hits.total.value,
      max_score: response.body.hits.max_score,
    };
  }

  // Xóa document khỏi index
  async deleteDocument(documentId) {
    return await this.client.delete({
      index: this.indexName,
      id: documentId,
    });
  }

  // Update document trong index
  async updateDocument(document) {
    return await this.client.update({
      index: this.indexName,
      id: document.document_id,
      body: {
        doc: {
          title: document.title,
          description: document.description,
          status: document.status,
          subject_name: document.subject?.subject_name,
          subject_code: document.subject?.subject_code,
          lecturer_name: document.lecturer?.lecturer_name,
        },
      },
    });
  }
}

module.exports = new ElasticsearchService();
```

## 🔄 Bước 3: Cập nhật documentController.js

Thay thế phần placeholder trong `getMyFile()`:

```javascript
// Import Elasticsearch service ở đầu file
const elasticsearchService = require('../services/elasticsearchService');

// Trong hàm getMyFile, thay thế phần:
if (search && search.trim() !== '') {
  // Sử dụng Elasticsearch cho tìm kiếm
  const elasticResults = await elasticsearchService.searchUserDocuments({
    userId,
    query: search.trim(),
    status,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  myDocuments = elasticResults.documents;
  totalDocuments = elasticResults.total;
} else {
  // ... existing code cho non-search
}
```

## 📊 Bước 4: Sync Data với Elasticsearch

Tạo script sync để đưa dữ liệu hiện có vào Elasticsearch:

```javascript
// scripts/syncElasticsearch.js
const prisma = require('../utils/db');
const elasticsearchService = require('../services/elasticsearchService');

async function syncAllDocuments() {
  try {
    console.log('Creating Elasticsearch index...');
    await elasticsearchService.createIndex();

    console.log('Fetching documents from database...');
    const documents = await prisma.document.findMany({
      include: {
        subject: true,
        lecturer: true,
      },
    });

    console.log(`Indexing ${documents.length} documents...`);
    for (const doc of documents) {
      await elasticsearchService.indexDocument(doc);
    }

    console.log('Sync completed successfully!');
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

syncAllDocuments();
```

## 🔧 Bước 5: Hooks cho Auto-sync

Cập nhật các operations để tự động sync với Elasticsearch:

### Upload Document:

```javascript
// Trong uploadFile() sau khi tạo document thành công
await elasticsearchService.indexDocument(newDocument);
```

### Update Document:

```javascript
// Trong updateFileDetails() sau khi update thành công
await elasticsearchService.updateDocument(updatedDocument);
```

### Delete Document:

```javascript
// Trong deleteFileDetails() sau khi delete thành công
await elasticsearchService.deleteDocument(documentId);
```

## 🌍 Bước 6: Environment Variables

Thêm vào `.env`:

```env
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=documents
```

## 🧪 Bước 7: Testing

```javascript
// Test search functionality
const testSearch = async () => {
  const results = await elasticsearchService.searchUserDocuments({
    userId: 1,
    query: 'toán học',
    page: 1,
    limit: 10,
  });

  console.log('Search results:', results);
};
```

## 📈 Bước 8: Advanced Features (Optional)

### Suggestions & Autocomplete:

```javascript
async getSuggestions(userId, query) {
  return await this.client.search({
    index: this.indexName,
    body: {
      suggest: {
        title_suggest: {
          prefix: query,
          completion: {
            field: 'title.suggest',
            size: 5
          }
        }
      },
      query: {
        term: { uploader_id: userId }
      }
    }
  });
}
```

### Analytics:

```javascript
async getSearchAnalytics(userId) {
  return await this.client.search({
    index: this.indexName,
    body: {
      query: { term: { uploader_id: userId } },
      aggs: {
        status_distribution: {
          terms: { field: 'status' }
        },
        file_types: {
          terms: { field: 'file_type' }
        }
      }
    }
  });
}
```

## ✅ Checklist hoàn thành

- [ ] Cài đặt Elasticsearch
- [ ] Tạo ElasticsearchService
- [ ] Cập nhật documentController
- [ ] Chạy script sync data
- [ ] Thêm hooks cho auto-sync
- [ ] Test search functionality
- [ ] Deploy và monitor

## 🔗 Resources

- [Elasticsearch Node.js Client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/index.html)
- [Search API Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-search.html)
- [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)
