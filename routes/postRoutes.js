const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const Comment = require('../models/Comment');

// Home Route
router.get('/home', async (req, res) => {
    const db = req.app.locals.db;
    const user = req.session.user;

    if (!db) {
        console.error("Database connection is not available in app.locals!");
        return res.status(500).send("Database connection error.");
    }

    try {
        const { tags, category } = req.query;
        console.log("Filtering by Tags:", tags, "Category:", category);

        // Fetch posts, users, and all comments
        const posts = await db.collection('posts').find({}).toArray();
        const users = await db.collection('users').find({}).toArray();
        const comments = await db.collection('comments').find({}).toArray();

        // Create a dictionary of profile pictures for quick lookup
        const profilePictures = {};
        users.forEach(user => {
            profilePictures[user.username] = user.profilePicture || "/images/blank-profile-picture.png";
        });

        // Count comments per post
        const commentCounts = {};
        comments.forEach(comment => {
            const pid = comment.postId?.toString();
            if (!commentCounts[pid]) commentCounts[pid] = 0;
            commentCounts[pid]++;
        });

        // Attach profile picture and comment count to each post
        posts.forEach(post => {
            post.profilePicture = profilePictures[post.author] || '/images/blank-profile-picture.png';
            post.commentCount = commentCounts[post._id.toString()] || 0;
        });

        // Filter posts by tags and category
        let filteredPosts = posts;

        if (tags) {
            const tagList = tags.split(',').map(tag => tag.trim().toLowerCase());
            filteredPosts = filteredPosts.filter(post =>
                post.tags?.some(tag => tagList.includes(tag.toLowerCase()))
            );
        }

        if (category) {
            filteredPosts = filteredPosts.filter(post => post.category === category);
        }

        // Popular posts (top 3 by votes)
        const popularPosts = [...posts]
            .sort((a, b) => b.votes - a.votes)
            .slice(0, 3);

        // Render with filters retained
        res.render('home', {
            title: 'Forum Friends - Home',
            posts: filteredPosts,
            popularPosts: popularPosts,
            user: user,
            query: { tags, category }
        });

    } catch (err) {
        console.error('Error fetching posts:', err);
        res.status(500).send('Error loading home page.');
    }
});




// Post Details Route
router.get('/post/:postId', async (req, res) => {
    const db = req.app.locals.db;
    const postId = req.params.postId;

    try {
        // Ensure the postId is a valid ObjectId
        if (!ObjectId.isValid(postId)) {
            return res.status(400).send("Invalid post ID format.");
        }

        const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
        if (!post) return res.status(404).send("Post not found.");

        // Fetch all posts to determine top 3 by votes
        const allPosts = await db.collection('posts').find({}).toArray();
        const popularPosts = [...allPosts]
            .sort((a, b) => b.votes - a.votes)
            .slice(0, 3);

        // Fetch comments for the post
        const comments = await db.collection('comments').find({ postId: new ObjectId(postId) }).toArray();

        // Helper function to build nested comments
        const buildNestedComments = (comments, parentId = null) => {
            const clone = (obj) => JSON.parse(JSON.stringify(obj));
          
            return comments
              .filter(comment => String(comment.parentCommentId) === String(parentId))
              .map(comment => {
                const cloned = clone(comment); // deep clone so replies don’t share object references
                cloned.replies = buildNestedComments(comments, comment._id);
                return cloned;
              });
          };
          
          

        // Construct the nested comment structure
        const nestedComments = buildNestedComments(comments);

        res.render('post-details', {
            post: post,
            comments: nestedComments,
            user: req.session.user,
            popularPosts: popularPosts //  Pass popular posts to view
        });
    } catch (err) {
        console.error("Error fetching post:", err);
        res.status(500).send("Error fetching post.");
    }
});


// Create Post Page
router.get('/create-post', (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }
    res.render('create-post', { title: 'Create Post', user: user });
});

// Create Post Route
router.post('/create-post', async (req, res) => {
    const db = req.app.locals.db;
    const { postTitle, postContent, postTags, postCategory } = req.body;
    const user = req.session.user;

    const allowedCategories = ["Technology", "Gaming", "Design"];
    const category = allowedCategories.includes(postCategory) ? postCategory : "Technology";

    try {
        // Fetch author data to get the profile picture
        const authorData = await db.collection('users').findOne({ username: user.username });

        // Log the author data to check if profile picture exists
        console.log("Author Data:", authorData);

        // Set profile picture, using a default if not found
        const profilePicture = authorData?.profilePicture || '/images/blank-profile-picture.png';
        console.log("Profile Picture being used:", profilePicture);

        const newPost = {
            title: postTitle,
            content: postContent,
            author: user.username,
            profilePicture: profilePicture,
            timestamp: new Date().toLocaleString(),
            tags: postTags ? postTags.split(',').map(tag => tag.trim()) : [],
            category: category,
            votes: 0,
            voters: {}
        };

        await db.collection('posts').insertOne(newPost);
        res.redirect('/home');
    } catch (err) {
        console.error("Error creating post:", err);
        res.status(500).send("Error creating post.");
    }
});


// Upvote a Post
router.post('/post/:id/upvote', async (req, res) => {
    try {
      const db = req.app.locals.db;
      const postId = req.params.id;
      const username = req.session.user?.username;
  
      const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
      if (!post) return res.status(404).json({ error: 'Post not found' });
  
      const voters = post.voters || {};
      const currentVote = voters[username];
  
      if (currentVote === 'upvote') {
        post.votes -= 1;
        delete voters[username];
      } else if (currentVote === 'downvote') {
        post.votes += 2;
        voters[username] = 'upvote';
      } else {
        post.votes += 1;
        voters[username] = 'upvote';
      }
  
      await db.collection('posts').updateOne(
        { _id: new ObjectId(postId) },
        { $set: { votes: post.votes, voters } }
      );
  
      res.status(200).json({ votes: post.votes });
    } catch (err) {
      console.error('Upvote failed:', err);
      res.status(500).json({ error: 'Upvote error' });
    }
  });
  
  



// Downvote a post
router.post('/post/:id/downvote', async (req, res) => {
    const db = req.app.locals.db;
    const postId = req.params.id;
    const userId = req.session.user?.username;
  
    if (!ObjectId.isValid(postId)) return res.status(400).json({ error: "Invalid post ID" });
  
    try {
      const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
      if (!post) return res.status(404).json({ error: 'Post not found' });
  
      const voters = post.voters || {};
      const currentVote = voters[userId];
      let voteChange = 0;
  
      if (currentVote === 'downvote') {
        delete voters[userId];
        voteChange = 1;
      } else if (currentVote === 'upvote') {
        voters[userId] = 'downvote';
        voteChange = -2;
      } else {
        voters[userId] = 'downvote';
        voteChange = -1;
      }
  
      const updatedPost = await db.collection('posts').findOneAndUpdate(
        { _id: new ObjectId(postId) },
        {
          $set: { voters: voters },
          $inc: { votes: voteChange }
        },
        { returnDocument: 'after' }
      );
  
      res.json({ votes: updatedPost.value.votes });
    } catch (err) {
      console.error('Downvote failed:', err);
      res.status(500).json({ error: 'Downvote error' });
    }
  });
  


// Update Post Route
router.post('/post/:postId/edit', async (req, res) => {
    const db = req.app.locals.db;
    const postId = req.params.postId;
    const { postTitle, postContent, postTags, postImage } = req.body;

    try {
        await db.collection('posts').updateOne(
            { _id: new ObjectId(postId) },
            { 
                $set: {
                    title: postTitle,
                    content: postContent,
                    tags: postTags ? postTags.split(',').map(tag => tag.trim()) : [],
                    image: postImage
                }
            }
        );

        res.redirect(`/post/${postId}`);
    } catch (err) {
        console.error("Error updating post:", err);
        res.status(500).send("Error updating post.");
    }
});

// Delete Post Route
router.post('/post/:postId/delete', async (req, res) => {
    const db = req.app.locals.db;
    const postId = req.params.postId;

    try {
        await db.collection('posts').deleteOne({ _id: new ObjectId(postId) });
        res.redirect('/home');
    } catch (err) {
        console.error("Error deleting post:", err);
        res.status(500).send("Error deleting post.");
    }
});

module.exports = router;
