const { Client } = require('@elastic/elasticsearch');

const elastic = new Client({ node: process.env.ELASTICSEARCH_URL });

module.exports = elastic;
