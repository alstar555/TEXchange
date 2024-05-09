const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = parseInt(process.argv[2]) || 5000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());

const POST_DB = 'post_db.csv';

const postsMap = new Map();
const MIN_SCORE = -5;

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
            if(post_copy.votes >= MIN_SCORE){
                postsMap.set(post_copy.postId, post_copy);
            }
        })
        .on('end', () => {
            res.json({ posts: posts});
        })
        .on('error', (err) => {
            console.error('Error reading CSV file:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
});


// Endpoint to save a post to CSV
app.post('/savePost', (req, res) => {
    const post = req.body;

    // Example: Save post data to a CSV file
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
            if(post.votes < MIN_SCORE){
                return -1;
            }
        }else{
            console.log("Hacker alert");
            return -1;
        }

    } 
    postsMap.set(post.postId, post);
    post.content = `"${post.content.replace(/\n/g, ' ')}"`;

    

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
