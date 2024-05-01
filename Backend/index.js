import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import ytdl from 'ytdl-core';
import cors from 'cors';
import fs from 'fs';
import cloudinary from 'cloudinary';
import ffmpeg from "fluent-ffmpeg";
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { readFileSync } from 'fs';
import axios from 'axios';

const firebaseConfig = {
    apiKey: "AIzaSyD4CNOeT0nUJc-XHDQZ6Jz0KUBXFbpZoFQ",
    authDomain: "youpromotor.firebaseapp.com",
    projectId: "youpromotor",
    storageBucket: "youpromotor.appspot.com",
    messagingSenderId: "479357442540",
    appId: "1:479357442540:web:c025bf14ff067ee1f908c9",
    measurementId: "G-E2PWWMGG8Y"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

const app = express();

// Parse JSON bodies
app.use(cors());
app.use(bodyParser.json());

cloudinary.config({
    cloud_name: 'dmqus2vrc',
    api_key: '121784611685526',
    api_secret: 'MHx4y0rIe76bMjHnlPdrh7jDTX8'
});

app.get('/', (req, res) => {
    res.send('Hello, world!');
});

app.get('/app/api/v1/youtube', async (req, res) => {
    try {
        const { channelId } = req.body;
        const response = await fetch(`https://aiotube.deta.dev/channel/%40${channelId}/uploads`);

        if (!response.ok) {
            throw new Error('Failed to fetch data from the external API');
        }

        const data = await response.json();
        console.log(data);

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Define a route to fetch the video data
app.get('/app/api/v1/fetch-video-data', async (req, res) => {
    try {
        const videoID = req.query.videoID;
        console.log('Video ID:', videoID);

        const videoUrl = `https://aiotube.deta.dev/video/${videoID}`;
        console.log('Video URL:', videoUrl);
        const response = await fetch(videoUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch video data');
        }
        const videoData = await response.json();
        res.json(videoData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



app.get('/app/api/v1/audio', async (req, res) => {
    try {
        const { videoId } = req.query;
        console.log('Video ID:', videoId);

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateURL(videoUrl)) {
            throw new Error('Invalid YouTube URL');
        }

        const videoInfo = await ytdl.getInfo(videoUrl);
        const videoFormat = ytdl.chooseFormat(videoInfo.formats, { filter: 'videoandaudio' });

        if (!videoFormat) {
            throw new Error('No video format found');
        }

        const tempFilePath = 'temp.mp4';
        const outputStream = fs.createWriteStream(tempFilePath);

        const videoStream = ytdl.downloadFromInfo(videoInfo, { format: videoFormat });
        videoStream.pipe(outputStream);

        videoStream.on('error', (error) => {
            console.error('Video download error:', error);
            res.status(500).json({ error: 'Failed to download video' });
        });

        outputStream.on('finish', async () => {
            console.log('Video downloaded successfully');

            try {
                await ffmpeg("temp.mp4")
                    .noVideo()
                    .audioChannels(2)
                    .audioFrequency(44100)
                    .format('mp3')
                    .audioBitrate('128k')
                    .on('end', async () => {
                        console.log('Finished processing audio');
                        const storage = getStorage(firebaseApp);
                        async function uploadAudioFile(fileName) {
                            try {
                                const fileData = readFileSync(fileName); // Read the file synchronously
                                const blob = new Blob([fileData], { type: 'audio/mp3' });
                                console.log(blob);// Create a Blob object
                                const storageRef = ref(storage, `audio/${fileName}`); // Reference to the location where you want to upload the file
                                await uploadBytes(storageRef, blob); // Upload the file
                                console.log("File uploaded successfully!");

                                // Get the download URL
                                const downloadURL = await getDownloadURL(storageRef);
                                console.log("Download URL:", downloadURL);
                                return downloadURL;
                            } catch (error) {
                                console.error("Error uploading file: ", error);
                                if (error.code === 'storage/unauthorized') {
                                    console.error("Ensure your Firebase Storage rules allow writing to the 'audio' folder.");
                                }
                            }
                        }




                        const downloadURL = await uploadAudioFile("output.mp3");

                        // Example usage
                        const requestData = {
                            "audioUrl": downloadURL,
                        };

                        const endpoint = 'http://127.0.0.1:57613'; // Replace this with the actual endpoint URL

                        try {
                            console.log('Calling worker:', endpoint);
                            const response = await fetch(endpoint, {
                                method: 'POST',
                                body: JSON.stringify(requestData),
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            });

                            if (!response.ok) {
                                throw new Error(`Failed to call worker: ${response.statusText}`);
                            }

                            const responseData = await response.json(); // Read the response body once
                            res.json(responseData); // Send the response to the client
                        } catch (error) {
                            console.error('Error calling worker:', error);
                            res.status(500).json({ error: 'Failed to call worker' });
                        }
                    })
                    .on('error', (err) => {
                        console.error('Error extracting audio:', err);
                        res.status(500).json({ error: 'Failed to process audio' });
                    })
                    .save("output.mp3");
            } catch (error) {
                console.error('Error processing audio:', error);
                res.status(500).json({ error: 'Failed to process audio' });
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
