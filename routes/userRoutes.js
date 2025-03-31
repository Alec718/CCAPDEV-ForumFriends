const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Login Page
router.get('/login', (req, res) => {
  const rememberedUsername = req.cookies.rememberedUsername || '';
  const rememberedPassword = req.cookies.rememberedPassword || '';
  res.render('login', { 
    title: 'Forum Friends - Login', 
    rememberedUsername, 
    rememberedPassword 
  });
});

// Login Route (POST)
router.post('/login', async (req, res) => {
  const db = req.app.locals.db;
  const { username, password, rememberMe } = req.body;  // Added rememberMe to check the checkbox

  try {
    const user = await db.collection('users').findOne({ username });

    if (!user) {
      console.log("❌ Login failed: user not found for", username);
      return res.render('login', {
        title: 'Forum Friends - Login',
        error: 'Invalid username or password.'
      });
    }

    console.log("✅ User found:", user);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("🔐 Password entered:", password);
    console.log("🔐 Password in DB:", user.password);
    console.log("🔐 Password match:", isMatch);

    if (!isMatch) {
      console.log("❌ Login failed: password mismatch for", username);
      return res.render('login', {
        title: 'Forum Friends - Login',
        error: 'Invalid username or password.'
      });
    }

    // Setting session data after login
    req.session.user = {
      id: user._id,
      username: user.username,
      profilePicture: user.profilePicture,
    };

    // Implementing Remember Me functionality
    if (rememberMe) {
      res.cookie('rememberedUsername', username, { maxAge: 1000 * 60 * 60 * 24 * 30, httpOnly: true }); // Save username in cookie for 30 days
      res.cookie('rememberedPassword', password, { maxAge: 1000 * 60 * 60 * 24 * 30, httpOnly: true }); // Save password in cookie for 30 days
    } else {
      res.clearCookie('rememberedUsername');  // Clear username cookie if "Remember Me" is unchecked
      res.clearCookie('rememberedPassword');  // Clear password cookie if "Remember Me" is unchecked
    }

    console.log("✅ Login successful for:", username);
    res.redirect('/home');

  } catch (err) {
    console.error('🔥 Error during login:', err);
    res.render('login', {
      title: 'Forum Friends - Login',
      error: 'An error occurred during authentication.'
    });
  }
});



// Registration Page
router.get('/register', (req, res) => {
  res.render('registration', { title: 'Forum Friends - Register' });
});

// Registration Logic (POST)
router.post('/register', async (req, res) => {
  const db = req.app.locals.db;
  const { username, email, password, confirmPassword, bio } = req.body;

  // Validate input
  if (!username || !email || !password || !confirmPassword) {
    return res.render('registration', {
      title: 'Forum Friends - Register',
      error: 'All fields are required.',
      formData: req.body
    });
  }

  if (password !== confirmPassword) {
    return res.render('registration', {
      title: 'Forum Friends - Register',
      error: 'Passwords do not match.',
      formData: req.body
    });
  }

  try {
    const existingUser = await db.collection('users').findOne({ username });
    if (existingUser) {
      return res.render('registration', {
        title: 'Forum Friends - Register',
        error: 'Username already exists.',
        formData: req.body
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      username,
      email,
      password: hashedPassword,
      bio,
      profilePicture: '/images/blank-profile-picture.png',
      createdAt: new Date()
    };

    await db.collection('users').insertOne(newUser);

    res.render('registration', {
      title: 'Forum Friends - Register',
      success: 'Registration successful! Redirecting to login page...',
      redirect: true
    });
  } catch (err) {
    console.error('Error during registration:', err);
    res.render('registration', {
      title: 'Forum Friends - Register',
      error: 'Registration failed. Please try again.'
    });
  }
});

// Logout Route
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    res.redirect('/login');
  });
});

// Profile Route
router.get('/profile/:username', async (req, res) => {
  const db = req.app.locals.db;
  const username = req.session.user.username;  // Use the logged-in user's username

  try {
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.status(404).send("User not found.");

    const posts = await db.collection('posts').find({ author: username }).toArray();
    const comments = await db.collection('comments').find({ author: username }).toArray();

    res.render('profile', {
      title: `${user.username} - Profile`,
      profile: user,
      latestPosts: posts.slice(-3),
      latestComments: comments.slice(-3)
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).send("Server error");
  }
});

// Edit Profile Page
router.get('/edit-profile', async (req, res) => {
  const db = req.app.locals.db;
  const username = req.session.user?.username;

  if (!username) return res.redirect('/login');

  try {
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.status(404).send("User not found.");

    res.render('edit-profile', {
      title: 'Edit Profile - Forum Friends',
      profile: user
    });
  } catch (err) {
    console.error('Error fetching profile for editing:', err);
    res.status(500).send("Server error");
  }
});

// Edit Profile Route 
router.post('/edit-profile/:username', async (req, res) => {
  const db = req.app.locals.db;
  const oldUsername = req.params.username;
  const { newUsername, bio, profilePictureURL } = req.body;

  try {
    if (oldUsername !== newUsername) {
      const existingUser = await db.collection('users').findOne({ username: newUsername });
      if (existingUser) {
        return res.render('edit-profile', {
          title: 'Edit Profile',
          profile: { username: oldUsername, bio: bio, profilePicture: profilePictureURL },
          errorMessage: 'Username already taken.'
        });
      }
    }

    await db.collection('users').updateOne(
      { username: oldUsername },
      { $set: { username: newUsername, bio: bio, profilePicture: profilePictureURL } }
    );

    await db.collection('posts').updateMany(
      { author: oldUsername },
      { $set: { author: newUsername } }
    );

    await db.collection('comments').updateMany(
      { author: oldUsername },
      { $set: { author: newUsername } }
    );

    req.session.user.username = newUsername;

    res.redirect(`/profile/${newUsername}`);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).send("Error updating profile");
  }
});

// View All Posts by User
router.get('/profile/:username/posts', async (req, res) => {
  const db = req.app.locals.db;
  const username = req.params.username;

  try {
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.status(404).send("User not found");

    const posts = await db.collection('posts').find({ author: username }).toArray();

    res.render('view-posts', {
      userProfile: user,
      posts: posts,
      title: `${username}'s Posts`,
      user: req.session.user
    });
  } catch (err) {
    console.error("Error fetching user posts:", err);
    res.status(500).send("Internal Server Error");
  }
});

// View All Comments by User
router.get('/profile/:username/comments', async (req, res) => {
  const db = req.app.locals.db;
  const username = req.params.username;

  try {
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.status(404).send("User not found");

    const comments = await db.collection('comments').find({ author: username }).toArray();

    comments.forEach(comment => {
      if (comment.postId && typeof comment.postId !== 'string') {
        comment.postId = comment.postId.toString();
      }
    });

    res.render('view-comments', {
      userProfile: user,
      comments: comments,
      title: `${username}'s Comments`,
      user: req.session.user
    });
  } catch (err) {
    console.error("Error fetching user comments:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
