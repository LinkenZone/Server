const { Client } = require('@elastic/elasticsearch');

const elastic = new Client({ node: process.env.ELASTICSEARCH_URL });

async function indexDocument(doc) {
  await elastic.index({
    index: 'documents',
    id: doc.id,
    body: {
      title: doc.title,
      description: doc.description,
      file_url: doc.file_url,
      file_type: doc.file_type,
      uploader_id: doc.uploader_id,
      uploader_name: doc.uploader.full_name,
      uploader_email: doc.uploader.email,
      subject_id: doc.subject_id,
      lecturer_id: doc.lecturer_id,
      status: doc.status,
      created_at: doc.created_at,
    },
  });
}

async function searchDocuments(q) {
  const must = [];

  if (q && q.trim().length > 0) {
    must.push({
      multi_match: {
        query: q,
        fields: ['title^3', 'description^2', 'content'],
        fuzziness: 'AUTO',
      },
    });
  } else {
    must.push({ match_all: {} });
  }

  const { result } = await elastic.search({
    index: 'documents',
    body: {
      query: {
        bool: {
          must,
        },
      },
    },
  });

  return result.hits.hits;
}

module.exports = {
  elastic,
  indexDocument,
  searchDocuments,
};
