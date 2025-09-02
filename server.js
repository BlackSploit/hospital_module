const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const WasabiServices = require('./index.js'); // endpoints are defined here

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Upload a file and verify checksum
app.post('/api/upload', async (req, res) => {
  try {
    const { remotePath, fileName } = req.body;
    const result = await WasabiServices.uploadFile(remotePath, fileName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Async upload with order update
app.post('/api/uploadAsync', async (req, res) => {
  try {
    const { remotePath, fileName, updateReq, sessionId } = req.body;
    const result = await WasabiServices.uploadFileAsync(remotePath, fileName, updateReq, sessionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download a file
app.post('/api/download', async (req, res) => {
  try {
    const { downloadLocation, s3Filepath } = req.body;
    await WasabiServices.downloadFile(downloadLocation, s3Filepath);
    res.json({ message: 'File downloaded successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get signed URL for a file
app.get('/api/signedUrl', async (req, res) => {
  try {
    const { s3FilePath } = req.query;
    const url = await WasabiServices.getSignedUrl(s3FilePath);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download multiple files as a zip from S3
app.post('/api/downloadZip', async (req, res) => {
  try {
    const { arrFilesObj, preferredFilename } = req.body;
    const result = await WasabiServices.downloadZipFile(arrFilesObj, preferredFilename);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download multiple files as a zip from local storage
app.post('/api/downloadZipLocal', async (req, res) => {
  try {
    const { arrFilesObj, preferredFilename } = req.body;
    const result = await WasabiServices.downloadZipFileLocal(arrFilesObj, preferredFilename);
    res.json({ path: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});