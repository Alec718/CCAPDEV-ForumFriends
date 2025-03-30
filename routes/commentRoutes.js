// Middleware to ensure user is logged in
function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({ error: 'User not authenticated' });
}

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const isAuthenticated = require('../middleware/auth');

const Comment = require('../models/Comment');
const Post = require('../models/Post');

// Add a comment
router.post('/post/:postId/comment', async (req, res) => {
    const { postId } = req.params;
    const { commentText } = req.body;
    const username = req.session.user?.username;

    if (!username) {
        return res.status(401).send("Unauthorized. Please log in.");
    }

    try {
        const newComment = new Comment({
            text: commentText,
            author: username,
            timestamp: new Date().toLocaleString(),
            postId: new ObjectId(postId)
        });

        await newComment.save();
        res.redirect(`/post/${postId}`);
    } catch (err) {
        console.error("Error adding comment:", err);
        res.status(500).send("Error adding comment.");
    }
});

// Edit Comment Route (MODIFY)
router.post('/comment/:id/edit', async (req, res) => {
    const db = req.app.locals.db;
    const commentId = req.params.id;
    const { text } = req.body;

    try {
        await db.collection('comments').updateOne(
            { _id: new ObjectId(commentId) },
            { $set: { text: text } }
        );

        res.status(200).json({ message: 'Comment updated successfully.' });
    } catch (err) {
        console.error('Error updating comment:', err);
        res.status(500).send('Error updating comment.');
    }
});


// DELETE route to delete a comment
router.delete('/comment/:id/delete', async (req, res) => {
    try {
        const commentId = req.params.id;

        // Find and delete the comment by ID
        const result = await Comment.findByIdAndDelete(commentId);

        // Check if the comment was successfully deleted
        if (result) {
            return res.status(200).json({ message: 'Comment deleted successfully' });
        } else {
            return res.status(404).json({ error: 'Comment not found' });
        }
    } catch (err) {
        console.error('Error deleting comment:', err);
        return res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// Get All Comments for a Post (Including Replies)
router.get('/post/:postId/comments', async (req, res) => {
    const db = req.app.locals.db;
    const postId = req.params.postId;

    try {
        const comments = await db.collection('comments').find({ postId: new ObjectId(postId) }).toArray();

        // Nest comments by parentCommentId
        const nestComments = (comments) => {
            const map = {};
            const roots = [];

            comments.forEach(comment => {
                map[comment._id] = { ...comment, replies: [] };
            });

            comments.forEach(comment => {
                if (comment.parentCommentId) {
                    map[comment.parentCommentId].replies.push(map[comment._id]);
                } else {
                    roots.push(map[comment._id]);
                }
            });

            return roots;
        };

        const nestedComments = nestComments(comments);
        res.json(nestedComments);
    } catch (err) {
        console.error('Error fetching comments:', err);
        res.status(500).send('Error fetching comments.');
    }
});


// Reply to Comment or Reply Route (POST)
router.post('/comment/:id/reply', async (req, res) => {
    const db = req.app.locals.db;
    const parentCommentId = req.params.id;
    const { text, postId } = req.body;
    const author = req.session.user.username;

    try {
        // Validate the input
        if (!text || !postId) {
            return res.status(400).json({ error: 'Text and Post ID are required.' });
        }

        // Check if parent comment exists
        const parentComment = await db.collection('comments').findOne({ _id: new ObjectId(parentCommentId) });
        if (!parentComment) {
            return res.status(404).json({ error: 'Parent comment not found.' });
        }

        // Construct the reply object
        const reply = {
            text: text,
            author: author,
            timestamp: new Date(),
            votes: 0,
            voters: {},
            parentCommentId: new ObjectId(parentCommentId), // Link to parent comment or reply
            postId: new ObjectId(postId) // Link to the post
        };

        // Insert the reply
        const result = await db.collection('comments').insertOne(reply);
        const insertedReply = await db.collection('comments').findOne({ _id: result.insertedId });

        res.status(200).json({ message: 'Reply added successfully.', reply: insertedReply });
    } catch (err) {
        console.error('Error adding reply:', err);
        res.status(500).json({ error: err.message || 'An unknown server error occurred.' });
    }
});




// Upvote Comment (POST)
router.post('/comment/:id/upvote', async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.body.userId;

        const comment = await Comment.findById(commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        if (!comment.voters) comment.voters = new Map();
        if (!(comment.voters instanceof Map)) {
            comment.voters = new Map(Object.entries(comment.voters));
        }

        const currentVote = comment.voters.get(userId);

        if (currentVote === 'upvote') {
            // Cancel upvote
            comment.votes -= 1;
            comment.voters.delete(userId);
        } else if (currentVote === 'downvote') {
            // Switch from downvote to upvote
            comment.votes += 2;
            comment.voters.set(userId, 'upvote');
        } else {
            // First-time upvote
            comment.votes += 1;
            comment.voters.set(userId, 'upvote');
        }

        await comment.save();
        res.status(200).json({ votes: comment.votes });

    } catch (err) {
        console.error('Error upvoting comment:', err);
        res.status(500).json({ error: 'Failed to upvote comment' });
    }
});


// Downvote comment
router.post('/comment/:id/downvote', async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.body.userId;

        const comment = await Comment.findById(commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        if (!comment.voters) comment.voters = new Map();
        if (!(comment.voters instanceof Map)) {
            comment.voters = new Map(Object.entries(comment.voters));
        }

        const currentVote = comment.voters.get(userId);

        if (currentVote === 'downvote') {
            // Cancel downvote
            comment.votes += 1;
            comment.voters.delete(userId);
        } else if (currentVote === 'upvote') {
            // Switch from upvote to downvote
            comment.votes -= 2;
            comment.voters.set(userId, 'downvote');
        } else {
            // First-time downvote
            comment.votes -= 1;
            comment.voters.set(userId, 'downvote');
        }

        await comment.save();
        res.status(200).json({ votes: comment.votes });

    } catch (err) {
        console.error('Error downvoting comment:', err);
        res.status(500).json({ error: 'Failed to downvote comment' });
    }
});



module.exports = router;
