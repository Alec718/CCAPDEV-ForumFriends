const express = require('express');
const router = express.Router();

// Root Route - Redirect to Login
router.get('/', (req, res) => {
  res.redirect('/login');
});

// About Route
router.get('/about', (req, res) => {
  const user = req.session.user; 

  res.render('about', {
    title: "About - Forum Friends",
    user: user 
  });
});


module.exports = router;

