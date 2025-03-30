const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const User = require('../models/User');



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
  const { username, password } = req.body;

  try {
      // Find user using Mongoose model
      const user = await User.findOne({ username });

      if (!user) {
          console.log("User not found during login");
          return res.render('login', {
              title: 'Forum Friends - Login',
              error: 'Invalid username or password.'
          });
      }

      console.log("User found during login:", user);
      console.log("Stored Password:", user.password);
      console.log("Entered Password:", password);

      // Compare password with hashed password
      const isMatch = await bcrypt.compare(password, user.password);
      console.log("Password Match:", isMatch);

      if (!isMatch) {
          console.log("Password mismatch");
          return res.render('login', {
              title: 'Forum Friends - Login',
              error: 'Invalid username or password.'
          });
      }

      // Store user data in session
      req.session.user = {
          id: user._id,
          username: user.username,
          profilePicture: user.profilePicture,
      };

      console.log("Login successful!");
      res.redirect('/home');
  } catch (err) {
      console.error('Error during login:', err);
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
      // Check if the username already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
          console.log("Username already exists during registration");
          return res.render('registration', {
              title: 'Forum Friends - Register',
              error: 'Username already exists.',
              formData: req.body
          });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log("Hashed Password during registration:", hashedPassword);

      // Create the new user
      const newUser = new User({
          username,
          email,
          password: hashedPassword,
          bio,
          profilePicture: '/images/blank-profile-picture.png',
          createdAt: new Date()
      });

      await newUser.save();
      console.log("Registration successful!");

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
  const username = req.params.username;

  try {
    const user = await db.collection('users').findOne({ username: username });
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Fetch user's posts and comments
    const posts = await db.collection('posts').find({ author: username }).toArray();
    const comments = await db.collection('comments').find({ author: username }).toArray();

    res.render('profile', {
      title: `${user.username} - Profile`,
      profile: user,  // Ensure that 'profile' contains the user data
      latestPosts: posts.slice(-3), // Show latest 3 posts
      latestComments: comments.slice(-3) // Show latest 3 comments
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).send("Server error");
  }
});

// Edit Profile Page (GET)
router.get('/edit-profile', async (req, res) => {
  const db = req.app.locals.db;
  const username = req.session.user?.username;

  if (!username) {
      return res.redirect('/login');
  }

  try {
      const user = await db.collection('users').findOne({ username });
      if (!user) {
          return res.status(404).send("User not found.");
      }

      res.render('edit-profile', {
          title: 'Edit Profile - Forum Friends',
          profile: user
      });
  } catch (err) {
      console.error('Error fetching profile for editing:', err);
      res.status(500).send("Server error");
  }
});

// Edit Profile Route (MODIFY)
router.post('/edit-profile/:username', async (req, res) => {
  const db = req.app.locals.db;
  const oldUsername = req.params.username;
  const { newUsername, bio, profilePictureURL } = req.body;

  try {
      // Check if the new username already exists (only if it has changed)
      if (oldUsername !== newUsername) {
          const existingUser = await db.collection('users').findOne({ username: newUsername });
          if (existingUser) {
              console.error(`Username ${newUsername} is already taken.`);
              return res.render('edit-profile', {
                  title: 'Edit Profile',
                  profile: { username: oldUsername, bio: bio, profilePicture: profilePictureURL },
                  errorMessage: 'Username already taken.'
              });
          }
      }

      // Update user information in the database
      await db.collection('users').updateOne(
          { username: oldUsername },
          {
              $set: {
                  username: newUsername,
                  bio: bio,
                  profilePicture: profilePictureURL
              }
          }
      );

      // Update all posts authored by the user
      await db.collection('posts').updateMany(
          { author: oldUsername },
          { $set: { author: newUsername } }
      );

      // Update all comments authored by the user (in the comments collection)
      await db.collection('comments').updateMany(
          { author: oldUsername },
          { $set: { author: newUsername } }
      );

      // Update session data with the new username
      req.session.user.username = newUsername;

      console.log(`Profile updated successfully from ${oldUsername} to ${newUsername}.`);
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

    //  Define comments first
    const comments = await db.collection('comments').find({ author: username }).toArray();

    //  Now you can safely loop
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

