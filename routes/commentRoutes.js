const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

// Middleware to ensure user is logged in
function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({ error: 'User not authenticated' });
}

// Add a comment
router.post('/post/:postId/comment', async (req, res) => {
    const db = req.app.locals.db;
    const { postId } = req.params;
    const { commentText } = req.body;
    const username = req.session.user?.username;

    if (!username) return res.status(401).send("Unauthorized. Please log in.");

    try {
        const newComment = {
            text: commentText,
            author: username,
            timestamp: new Date().toLocaleString(),
            postId: new ObjectId(postId),
            votes: 0,
            voters: {},
            parentCommentId: null
        };

        await db.collection('comments').insertOne(newComment);
        res.redirect(`/post/${postId}`);
    } catch (err) {
        console.error("Error adding comment:", err);
        res.status(500).send("Error adding comment.");
    }
});

// Edit Comment Route
router.post('/comment/:id/edit', async (req, res) => {
    const db = req.app.locals.db;
    const commentId = req.params.id;
    const { text } = req.body;

    try {
        await db.collection('comments').updateOne(
            { _id: new ObjectId(commentId) },
            { $set: { text: text, editedAt: new Date() } }
        );

        // Send success message and reload post details page
        const updatedComment = await db.collection('comments').findOne({ _id: new ObjectId(commentId) });

        res.render('post-details', {
            successMessage: 'Comment edited successfully!',
            post: await db.collection('posts').findOne({ _id: new ObjectId(updatedComment.postId) }),
            comments: await db.collection('comments').find({ postId: updatedComment.postId }).toArray(),
            user: req.session.user
        });
    } catch (err) {
        console.error('Error updating comment:', err);
        res.status(500).send('Error updating comment.');
    }
});


// Delete Comment Route
router.delete('/comment/:id/delete', async (req, res) => {
    const db = req.app.locals.db;
    const commentId = req.params.id;

    try {
        const result = await db.collection('comments').deleteOne({ _id: new ObjectId(commentId) });

        if (result.deletedCount > 0) {
            // Send success message and reload post details page
            const deletedComment = await db.collection('comments').findOne({ _id: new ObjectId(commentId) });

            res.render('post-details', {
                successMessage: 'Comment deleted successfully!',
                post: await db.collection('posts').findOne({ _id: new ObjectId(deletedComment.postId) }),
                comments: await db.collection('comments').find({ postId: deletedComment.postId }).toArray(),
                user: req.session.user
            });
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

        const nestComments = (comments) => {
            const map = {};
            const roots = [];

            comments.forEach(comment => {
                map[comment._id] = { ...comment, replies: [] };
            });

            comments.forEach(comment => {
                if (comment.parentCommentId) {
                    map[comment.parentCommentId]?.replies.push(map[comment._id]);
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

// Reply to Comment or Reply
router.post('/comment/:id/reply', async (req, res) => {
    const db = req.app.locals.db;
    const parentCommentId = req.params.id;
    const { text, postId } = req.body;
    const author = req.session.user?.username;

    if (!text || !postId) {
        return res.status(400).json({ error: 'Text and Post ID are required.' });
    }

    try {
        const parentComment = await db.collection('comments').findOne({ _id: new ObjectId(parentCommentId) });
        if (!parentComment) {
            return res.status(404).json({ error: 'Parent comment not found.' });
        }

        const reply = {
            text: text,
            author: author,
            timestamp: new Date(),
            votes: 0,
            voters: {},
            parentCommentId: new ObjectId(parentCommentId),
            postId: new ObjectId(postId)
        };

        const result = await db.collection('comments').insertOne(reply);
        const insertedReply = await db.collection('comments').findOne({ _id: result.insertedId });

        res.status(200).json({ message: 'Reply added successfully.', reply: insertedReply });
    } catch (err) {
        console.error('Error adding reply:', err);
        res.status(500).json({ error: err.message || 'An unknown server error occurred.' });
    }
});

// Upvote Comment
router.post('/comment/:id/upvote', async (req, res) => {
    const db = req.app.locals.db;
    const commentId = req.params.id;
    const userId = req.session.user?.username;

    if (!ObjectId.isValid(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });

    try {
        const comment = await db.collection('comments').findOne({ _id: new ObjectId(commentId) });
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        const voters = comment.voters || {};
        const currentVote = voters[userId];
        let voteChange = 0;

        if (currentVote === 'upvote') {
            delete voters[userId];
            voteChange = -1;
        } else if (currentVote === 'downvote') {
            voters[userId] = 'upvote';
            voteChange = 2;
        } else {
            voters[userId] = 'upvote';
            voteChange = 1;
        }

        await db.collection('comments').updateOne(
            { _id: new ObjectId(commentId) },
            {
                $set: { voters: voters },
                $inc: { votes: voteChange }
            }
        );

        res.status(200).json({ votes: comment.votes + voteChange });
    } catch (err) {
        console.error('Error upvoting comment:', err);
        res.status(500).json({ error: 'Failed to upvote comment' });
    }
});

// Downvote Comment
router.post('/comment/:id/downvote', async (req, res) => {
    const db = req.app.locals.db;
    const commentId = req.params.id;
    const userId = req.session.user?.username;

    if (!ObjectId.isValid(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });

    try {
        const comment = await db.collection('comments').findOne({ _id: new ObjectId(commentId) });
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        const voters = comment.voters || {};
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

        await db.collection('comments').updateOne(
            { _id: new ObjectId(commentId) },
            {
                $set: { voters: voters },
                $inc: { votes: voteChange }
            }
        );

        res.status(200).json({ votes: comment.votes + voteChange });
    } catch (err) {
        console.error('Error downvoting comment:', err);
        res.status(500).json({ error: 'Failed to downvote comment' });
    }
});

module.exports = router;
