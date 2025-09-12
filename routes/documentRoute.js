const express = require('express');
const documentController = require('./../controllers/documentController');

const router = express.Router();

router
  .route('/')
  .post(documentController.uploadFile)
  .get(documentController.getAllFile);

router.get('/my-documents', documentController.getMyFile);

router
  .route('/:id')
  .get(documentController.getFileDetails)
  .patch(documentController.updateFileDetails)
  .delete(documentController.deleteFileDetails);

router
  .route('/:id/comments')
  .get(documentController.getAllComments)
  .post(documentController.addComment);

router.post('/:id/ratings', documentController.addRating);

module.exports = router;
