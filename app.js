const http = require('http');
const fetch = require('node-fetch');
const url = require('url');
const sqlite3 = require('sqlite3').verbose();

// Create or open the SQLite database
const db = new sqlite3.Database('data.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the data.db SQLite database.');
});

// Create a new table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS streams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        videoUrl TEXT NOT NULL,
        channelName TEXT NOT NULL,
        streamingUrl TEXT NOT NULL
    )`, (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Streams table created or already exists.');
    });
});

// Function to fetch DASH URL from YouTube
async function dashUrl(ytUrl) {
    return await fetch(ytUrl)
        .then(async (r) => await r.text())
        .then((r) => r.match(/(?<=dashManifestUrl":").+?(?=",)/g)[0]);
}

// Function to fetch HLS URL from YouTube
async function hlsUrl(ytUrl) {
    return await fetch(ytUrl)
        .then(async (r) => await r.text())
        .then((r) => r.match(/(?<=hlsManifestUrl":").*\.m3u8/g)[0]);
}

// Function to store stream data in the database
function storeStreamData(videoUrl, channelName, streamingUrl) {
    db.run(`INSERT INTO streams (videoUrl, channelName, streamingUrl) VALUES (?, ?, ?)`, [videoUrl, channelName, streamingUrl], function(err) {
        if (err) {
            return console.error(err.message);
        }
        console.log(`A row has been inserted with rowid ${this.lastID}`);
    });
}

// Function to generate streaming URL
async function generateStreamingUrl(videoUrl, channelName) {
    const liveUrl = `https://www.youtube.com/@${channelName}/live`;

    // Attempt to get DASH URL first
    try {
        const streamingUrl = await dashUrl(liveUrl);
        storeStreamData(videoUrl, channelName, streamingUrl);
        return streamingUrl;
    } catch {
        const streamingUrl = await hlsUrl(videoUrl);
        storeStreamData(videoUrl, channelName, streamingUrl);
        return streamingUrl;
    }
}

// HTML form for submitting video URL and channel name
const htmlForm = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YouTube Stream URL Generator</title>
</head>
<body>
    <h1>YouTube Stream URL Generator</h1>
    <form action="/generate-url" method="GET">
        <label for="videoUrl">Video URL:</label><br>
        <input type="text" id="videoUrl" name="videoUrl" required><br>
        <label for="channelName">Channel Name:</label><br>
        <input type="text" id="channelName" name="channelName" required><br><br>
        <input type="submit" value="Generate Streaming URL">
    </form>
</body>
</html>
`;

// Handle incoming requests
async function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    let pathName = parsedUrl.pathname.split("/");

    if (pathName[3] === "master.mpd") {
        try {
            res.writeHead(302, {
                Location: await dashUrl(
                    "https://www.youtube.com/@MinimalGroupOfficial" + pathName[2] + "/live"
                ),
            });
            res.end(); // Ensure the response is ended here
        } catch (err) {
            res.writeHead(302, {
                Location: await dashUrl("https://www.youtube.com/watch?v=CsdMnxSENrI" + pathName[2]),
            });
            res.end();
        }
    } else if (pathName[3] === "master.m3u8") {
        try {
            res.writeHead(302, {
                Location: await hlsUrl(
                    "https://www.youtube.com/@MinimalGroupOfficial" + pathName[2] + "/live"
                ),
            });
            res.end();
        } catch (err) {
            res.writeHead(302, {
                Location: await hlsUrl("https://www.youtube.com/watch?v=CsdMnxSENrI" + pathName[2]),
            });
            res.end();
        }
    } else if (pathName[1] === 'generate-url') {
        const videoUrl = parsedUrl.query.videoUrl;
        const channelName = parsedUrl.query.channelName;

        if (videoUrl && channelName) {
            try {
                const streamingUrl = await generateStreamingUrl(videoUrl, channelName);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ url: streamingUrl }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Failed to generate URL' }));
            }
        } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Missing parameters' }));
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlForm); // Serve the HTML form for root URL
    }
}

// Create the server
const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(err.stack);
    });
});

// Start the server
server.listen(8080, () => {
    console.log('Server is running on port 8080');
});

// Close the database connection when the server is stopped
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
        process.exit(0);
    });
});
