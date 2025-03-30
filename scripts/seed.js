// seed.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function seedDB() {
    const client = new MongoClient(process.env.MONGO_URI);
    try {
        await client.connect();
        const db = client.db('forum_friends');

        const users = db.collection('users');
        const posts = db.collection('posts');
        const comments = db.collection('comments');

        await users.insertMany([
            { username: "john_doe", email: "john@example.com", password: "1234", bio: "Just a guy." },
            { username: "jane_doe", email: "jane@example.com", password: "abcd", bio: "A creative mind." },
            { username: "alice", email: "alice@example.com", password: "pass123", bio: "Frontend enthusiast." },
            { username: "bob", email: "bob@example.com", password: "bob2021", bio: "Backend wizard." },
            { username: "charlie", email: "charlie@example.com", password: "qwerty", bio: "Full-stack dev." },
        ]);

        console.log("Sample data created successfully");
    } finally {
        await client.close();
    }
}

seedDB().catch(console.error);
