const express = require('express');
const router = express.Router();

// Root Route - Redirect to Login
router.get('/', (req, res) => {
  res.redirect('/login');
});

module.exports = router;

