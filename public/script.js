const MAX_WORD_COUNT = 1000;

document.addEventListener('DOMContentLoaded', function () {

    const form = document.getElementById('postForm');
    const postContainer = document.getElementById('postContainer'); // Updated variable name
    let userId = getCookie('userId') || generateRandomId(); // Generate a unique user ID
    let posts = []; // Array to store posts
    fetchPosts();

    setCookie("userId", userId);

    form.addEventListener('submit', function (event) {
        event.preventDefault(); // Prevent the default form submission
        const postContent = postContentTextarea.value;
        if(checkWordCount(postContent)){ // Post Must Reach Word count
            submitPost();
        } 
    });

    const postContentTextarea = document.getElementById('postContent');
    const wordCountDisplay = document.getElementById('wordCountDisplay');

    postContentTextarea.addEventListener('input', function () {
        const postContent = postContentTextarea.value;
        const wordCount = postContent.split(/\s+/).filter(word => word.length > 0).length;
        wordCountDisplay.textContent = `${wordCount}/${MAX_WORD_COUNT}`;
    });



    postContentTextarea.addEventListener('keypress', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            const postContent = postContentTextarea.value;
            if(checkWordCount(postContent)){ // Post Must Reach Word count
                submitPost();
            }
        }
    });

    function submitPost() {
        // Get the content from the textarea
        const postContent = postContentTextarea.value;

        // Check if the post content is not empty
        if (postContent === '') {
            alert('Please enter some content before posting.'); // Show an alert
            return; // Exit the function
        }

        // Get the current date and time in 24-hour format
        const currentDate = new Date();
        const year = String(currentDate.getFullYear());
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const hours = String(currentDate.getHours()).padStart(2, '0');
        const minutes = String(currentDate.getMinutes()).padStart(2, '0');
        const seconds = String(currentDate.getSeconds()).padStart(2, '0');
        const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        // Create a post object with user ID, content, and timestamp
        const post = {
            userId: userId,
            content: postContent,
            timestamp: timestamp,
            votes: 1,
            votedBy: userId,
            postId: generateRandomId(), // Generate a unique post ID
        };

        // Clear the textarea by setting its value to an empty string
        postContentTextarea.value = '';

        // Add the new post to the posts array
        posts.push(post);

        // Send the post data to the server to save to CSV
        savePostToServer(post);

        // Sort posts based on vote scores and update the display
        sortPostsByVoteScore();

    }

    // Function to generate a unique user ID (for demonstration purposes)
    function generateRandomId() {
        return Math.random().toString(36).substr(2, 9); // Random alphanumeric ID
    }

    // Function to append post content to the page
    function appendPostToPage(post) {
        const postDiv = document.createElement('div');
        postDiv.classList.add('post');

        const headerDiv = document.createElement('div');
        headerDiv.classList.add('post-header');

        const usernameSpan = document.createElement('span');
        const strongElement = document.createElement('strong');
        strongElement.textContent = post.userId;
        usernameSpan.classList.add('username');
        usernameSpan.appendChild(strongElement);

        const timestampSpan = document.createElement('span');
        timestampSpan.classList.add('timestamp');
        timestampSpan.textContent = post.timestamp;

        headerDiv.appendChild(usernameSpan);
        headerDiv.appendChild(document.createTextNode(' '));
        headerDiv.appendChild(timestampSpan);

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('post-content');

        // Create the link element
        const postLink = document.createElement('a');
        postLink.href = `/thread/${post.postId}`;
        postLink.textContent = post.content;
        postLink.target = "_blank";
        contentDiv.appendChild(postLink);

        const voteContainer = document.createElement('div');
        voteContainer.classList.add('vote-container');

        const upvoteBtn = document.createElement('button');
        upvoteBtn.classList.add('upvote-btn');
        upvoteBtn.addEventListener('click', function() {
            updatePostInfo(postDiv, post, 1);
            sortPostsByVoteScore();
        });

        const downvoteBtn = document.createElement('button');
        downvoteBtn.classList.add('downvote-btn');
        downvoteBtn.addEventListener('click', function() {
            updatePostInfo(postDiv, post, -1);
            sortPostsByVoteScore();
        });

        const voteScore = document.createElement('span');
        voteScore.textContent = `${post.votes}`;
        voteScore.classList.add('vote-score');

        voteContainer.appendChild(upvoteBtn);
        voteContainer.appendChild(downvoteBtn);
        voteContainer.appendChild(voteScore);

        postDiv.appendChild(headerDiv);
        postDiv.appendChild(contentDiv);
        postDiv.appendChild(voteContainer);

        postContainer.appendChild(postDiv);
    }

    // Function to update post information (vote score)
    function updatePostInfo(postDiv, post, v) {
        // Update the vote score text content in the existing vote score element
        console.log(post);
        const voteScore = postDiv.querySelector('.vote-score');
        if (!(post.votedBy.includes(userId))) {
             post.votes += v;
            voteScore.textContent = `${post.votes}`;
            post.votedBy+= ` ${userId}`; // Disable voting after vote
            savePostToServer(post);
        }
    }

    // Function to sort posts by vote score and reorder them in the DOM
    function sortPostsByVoteScore() {
        // Sort posts array by vote scores in descending order
        posts.sort((a, b) => b.votes - a.votes);

        // Clear the existing posts in the postContainer
        postContainer.innerHTML = '';

        // Append sorted posts to the postContainer in the new order
        posts.forEach(post => {
            appendPostToPage(post);
        });
    }

    function getCookie(name) {
        const cookies = document.cookie.split(';');
        for (let c of cookies) {
            const [cookieName, cookieValue] = c.trim().split('=');
            if (cookieName === name) {
                return cookieValue; 
            }
        }
        return null;
    }

    function setCookie(name, value) {
        document.cookie = `${name}=${value}`;
    }


     // Function to save post to the server
     function savePostToServer(post) {
        fetch('/savePost', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(post),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Post saved successfully:', data);
        })
        .catch(error => {
            console.error('Error saving post:', error);
        });
    }


    function fetchPosts() {
        fetch('/api/posts')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                posts = data.posts;
                sortPostsByVoteScore();
            })
            .catch(error => {
                console.error('Error fetching posts:', error);
            });
    }

    function checkWordCount(content){
        const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
        if (wordCount > MAX_WORD_COUNT) {
            alert(`Your post exceeds word limit of ${MAX_WORD_COUNT} words.`);
            return false; // Return false to indicate the word count requirement is not met
        }

        return true;

    }

});
