
const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');


const app = express();
const PORT = parseInt(process.argv[2]) || 5000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());

const POST_DB = 'post_db.csv';

const postsMap = new Map();
const MIN_SCORE = -5;

const MAX_WORD_COUNT = 1000;
const MAX_CHAR_COUNT = 2000;


// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

// Apply the rate limiter to all requests
app.use(limiter);


app.get('/api/posts', (req, res) => {
    const posts = [];


    fs.createReadStream(path.join(__dirname, POST_DB))
        .pipe(csv())
    
        .on('data', (row) => {
            // Map CSV data to post object using headers
            const post = {
                userId: row['userId'],
                content: row['content'],
                timestamp: row['timestamp'],
                votes: parseInt(row['votes']), // Convert votes to a number
                votedBy: row['votedBy'],
                postId: row['postId'],
            };
            post.content = post.content.replace(/"/g, '');
            posts.push(post);

            const post_copy = JSON.parse(JSON.stringify(post));
            post_copy.content = `"${post_copy.content.replace(/\n/g, ' ')}"`;
            postsMap.set(post_copy.postId, post_copy);
        })
        .on('end', () => {
            res.json({ posts: posts});
        })
        .on('error', (err) => {
            console.error('Error reading CSV file:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
});

function checkWordCount(content){
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    return wordCount;
}


app.post('/savePost', (req, res) => {
    const post = req.body;

    // Security checks
    if (post.content.length >= MAX_CHAR_COUNT) {
        res.status(400).json({ error: 'Post content exceeds maximum character count' });
        return;
    }
    if (checkWordCount(post.content) >= MAX_WORD_COUNT) {
        res.status(400).json({ error: 'Post content exceeds maximum word count' });
        return;
    }

    // Only proceed to savePostToCSV if security checks pass
    savePostToCSV(post, (err) => {
        if (err) {
            console.error('Error saving post to CSV:', err);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            res.status(200).json({ message: 'Post saved successfully' });
        }
    });
});




// Function to save post data to CSV
function savePostToCSV(post, callback) {
    const csvHeader = 'userId,content,timestamp,votes,votedBy,postId\n';
    const csvFilePath = path.join(__dirname, POST_DB);

    // Check if the post ID already exists in the map
    if (postsMap.has(post.postId)) {
        //Check if vote only went up/down by one
        if(Math.abs(postsMap.get(post.postId).votes - post.votes)==1){
            // Overwrite the existing post data
            postsMap.delete(post.postId);
        }else{
            console.log("Hacker alert");
            return -1;
        }

    } 

    if(post.votes >= MIN_SCORE){
        postsMap.set(post.postId, post);
        post.content = `"${post.content.replace(/\n/g, ' ')}"`;
    }


    // Convert the posts map back to CSV format
    let csvData = csvHeader;
    for (const [postId, postObj] of postsMap) {
        csvData += `${Object.values(postObj).join(',')}\n`;
    }

    //clear CSV 
    fs.truncate(csvFilePath, 0, function(err, bytes){ 
    if (err){ 
        console.log(err); 
    } 
    }); 
    // Write the updated CSV data back to the file
    fs.writeFile(csvFilePath, csvData, callback);
}


// Render the index.ejs template with posts data
app.get('/', (req, res) => {
    res.render('index', { posts: [] }); // You can pass actual posts data here
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}...`);
    console.log(`Click http://localhost:${PORT} to access the Node.js server.`);
});

// Add to your existing code
const COMMENTS_DB = 'comments.csv';

app.get('/thread/:postId', (req, res) => {
    const postId = req.params.postId;
    const post = postsMap.get(postId);
    const comments = loadCommentsForPost(postId);
    res.render('thread', { post, comments });
});

function loadCommentsForPost(postId) {
    const comments = [];
    if (fs.existsSync(COMMENTS_DB)) {
        fs.createReadStream(COMMENTS_DB)
            .pipe(csv())
            .on('data', (row) => {
                if (row.postId === postId) {
                    comments.push(row);
                }
            });
    }
    return comments;
}

app.post('/thread/:postId/comment', (req, res) => {
    const comment = {
        postId: req.params.postId,
        userId: req.body.userId,
        content: req.body.content,
        timestamp: new Date().toISOString(),
        votes: 1,
        votedBy: req.body.userId
    };
    saveCommentToCSV(comment);
    res.json({ success: true });
});

app.get('/thread/:postId', (req, res) => {
    const postId = req.params.postId;
    const post = postsMap.get(postId);

    if (!post) {
        return res.status(404).send('Post not found');
    }

    // Initialize comments array
    const comments = [];

    // Check if comments file exists and read it
    if (fs.existsSync(COMMENTS_DB)) {
        fs.createReadStream(COMMENTS_DB)
            .pipe(csv())
            .on('data', (row) => {
                if (row.postId === postId) {
                    comments.push(row);
                }
            })
            .on('end', () => {
                res.render('thread', { post, comments });
            });
    } else {
        res.render('thread', { post, comments: [] });
    }
});