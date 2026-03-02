const express = require('express');
const IdentityController = require('../controllers/identity.controller');
const { validateIdentifyRequest } = require('../middlewares/validation');

const router = express.Router();

// POST /identify
router.post('/identify', validateIdentifyRequest, IdentityController.identify);

module.exports = router;
