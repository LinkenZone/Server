const express = require('express');
const ratingController = require('./../controllers/ratingController');
const authController = require('./../controllers/authController');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(ratingController.getRatings)
  .post(authController.protect, ratingController.addRating);

router
  .route('/:ratingId')
  .patch(authController.protect, ratingController.updateRating);

module.exports = router;
