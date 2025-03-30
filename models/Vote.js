// Vote.js
const { ObjectId } = require('mongodb');

const voteSchema = {
    user: ObjectId,
    target: ObjectId, // Post or Comment ID
    voteType: String, // 'upvote' or 'downvote'
    createdAt: { type: Date, default: Date.now }
};

function createVoteModel(db) {
    return db.collection('votes');
}

module.exports = { voteSchema, createVoteModel };
