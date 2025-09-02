const fs = require('fs');
const S3 = require('aws-sdk/clients/s3');
const AWS = require('aws-sdk');
const async = require('async');
const archiver = require('archiver');

const crypto = require('crypto');

const logger = require('../utilities/logger');
const commonService = require('./commonServices');
const orderService = require('../services/OrderService');

const wasabiEndpoint = new AWS.Endpoint(`http://${process.env.SERVER_NAME}`);
// const wasabiSecureEndpoint = new AWS.Endpoint(commonService.removeHttpfromUrl(process.env.SERVER_NAME));
const accessKeyId = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_KEY;
const bucketName = process.env.BUCKET_NAME;
l
const dirPath = process.env.DIR_PATH;
const localDownloadPath = process.env.PROXY_LOCAL_DOWNLOAD_PATH;

const s3 = new S3({
    endpoint: wasabiEndpoint,
    region: process.env.S3_REGION,
    accessKeyId,
    secretAccessKey
});
// c = new S3({
//     endpoint: wasabiSecureEndpoint,
//     region: process.env.S3_REGION,
//     accessKeyId,
//     secretAccessKey
// });




// async function uploadFile({ remotePath, fileName }) {

//     return new Promise((resolve, reject) => {
//         const params = {
//             Bucket: bucketName,
//             Key: fileName,
//             Body: fs.readFileSync(remotePath)
//         };
//         // logger.info(`Entered Wasabi Services ::: ${fileName}`);
//         s3.upload(params, function (s3Err, data) {
//             if (s3Err) {
//                 logger.error(`Error WASABI ==> ${s3Err}`);
//                 return reject(s3Err);
//             } else {
//                 return resolve(fileName);
//             }
//         });
//     });
// }




async function uploadAndVerifyFile(remotePath, fileName) {
    const s3 = new AWS.S3({
        endpoint: wasabiEndpoint,
        region: process.env.S3_REGION,
        accessKeyId,
        secretAccessKey
    });

    // 1. Calculate checksum of original file
    const originalHash = await new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(remotePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });

    // 2. Use multipart upload (stream, not readFileSync)
    const uploadParams = {
        Bucket: bucketName,
        Key: fileName,
        Body: fs.createReadStream(remotePath)
    };
    await s3.upload(uploadParams).promise();

    // 3. Download uploaded file to temp location
    const tempDownloadPath = remotePath + '.downloaded';
    const downloadParams = {
        Bucket: bucketName,
        Key: fileName
    };
    const downloadedData = await s3.getObject(downloadParams).promise();
    fs.writeFileSync(tempDownloadPath, downloadedData.Body);

    // 4. Calculate checksum of downloaded file
    const downloadedHash = await new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(tempDownloadPath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });

    // 5. Compare checksums
    fs.unlinkSync(tempDownloadPath); // cleanup
    if (originalHash !== downloadedHash) {
        throw new Error('Checksum mismatch: File corrupted during upload.');
    }

    return { fileName, checksum: originalHash, status: 'verified' };
}





async function uploadFileAsync(remotePath, fileName, updateReq, sessionId) {

    return new Promise((resolve, reject) => {
        const params = {
            Bucket: bucketName,
            Key: fileName,
            Body: fs.readFileSync(remotePath)
        };

        // logger.info(`Entered Wasabi Services ::: ${fileName}`);

        s3.upload(params, function (s3Err, data) {
            if (s3Err) {
                logger.error(`Error WASABI for ${fileName} ==> ${s3Err}`);
                return reject(s3Err);
            }

            // logger.info(`File uploaded successfully at ::: ${data.Location}`);

            orderService.updateDsOrderAsync(updateReq, sessionId)
                .catch((err) => {
                    logger.error(`Update Ds Order ==> ${err}`);
                });
            return resolve(data);
        });
    });
}

async function downloadFile(downloadLocation, s3Filepath) {
    return new Promise((resolve, reject) => {

        const params = {
            Bucket: bucketName,
            Key: s3Filepath
        };
        s3.getObject(params, (err, data) => {
            if (err) {
                logger.error(`Wasabi Download Error`);
                reject(err);
            }
            fs.writeFileSync(downloadLocation, data);
        });
    });
}

async function getSignedUrl(s3FilePath) {

    return new Promise((resolve, reject) => {
        s3.getSignedUrl('getObject', {
            Expires: 300,
            Bucket: bucketName,
            Key: s3FilePath
        }, function (err, url) {
            if (err) {
                logger.error(`Error: ${err}`);
                return reject(err);
            }
            logger.info(`URL is ${url}`);
            console.log(`URL is ${url}`)
            return resolve(url);
        });
    });
}
async function downloadZipFile(arrFilesObj, preferredFilename) {
    const zipFile = archiver('zip', { zlib: { level: 9 } });

    const curDate = new Date();
    const curTimeStamp = `${curDate.getFullYear()}${commonService.zeroFill(curDate.getMonth() + 1)}${commonService.zeroFill(curDate.getDate())}_${commonService.zeroFill(curDate.getHours())}${commonService.zeroFill(curDate.getMinutes())}${commonService.zeroFill(curDate.getSeconds())}`;
    let downloadName = `downloads/orders_${commonService.randomFixedInteger(6)}_${curTimeStamp}.zip`;
    if (preferredFilename) {
        downloadName = `downloads/${preferredFilename}`;
    }

    return new Promise((resolve, reject) => {

        zipFile.on('warning', error => {
            return reject(error);
        });

        zipFile.on('error', error => {
            return reject(error);
        });

        const writeStream = fs.createWriteStream(`${commonService.getActualFpath(dirPath, true)}${downloadName}`);
        zipFile.pipe(writeStream);

        async.eachLimit(arrFilesObj, 10, function (fileObj, next) {
            const params = {
                Bucket: bucketName,
                Key: fileObj.key
            };
            s3.getObject(params, function (err, data) {
                if (err) {
                    logger.error(`Bulk download failed because of file not found ${err}`);
                    // next();
                    return reject(err);
                } else {
                    // logger.info(`Files Object ::: ${JSON.stringify(fileObj)}`);
                    zipFile.append(data.Body, { name: fileObj.name })
                    next();
                }
            });
        }, function (err) {
            if (err) {
                logger.error(`Get Object Error :: ${err}`);
                return reject(err);
            } else {
                zipFile
                    .finalize()
                    .then((response) => {
                        return resolve({ remotePath: `${commonService.getActualFpath(dirPath, true)}${downloadName}`, fileName: downloadName });
                    })


            }
        });
    });
}
async function downloadZipFileLocal(arrFilesObj, preferredFilename) {
    const zipFile = archiver('zip', { zlib: { level: 9 } });

    const curDate = new Date();
    const curTimeStamp = `${curDate.getFullYear()}${commonService.zeroFill(curDate.getMonth() + 1)}${commonService.zeroFill(curDate.getDate())}_${commonService.zeroFill(curDate.getHours())}${commonService.zeroFill(curDate.getMinutes())}${commonService.zeroFill(curDate.getSeconds())}`;

    let downloadName = `downloads/orders_${commonService.randomFixedInteger(6)}_${curTimeStamp}.zip`;

    return new Promise((resolve, reject) => {

        zipFile.on('warning', error => {
            return reject(error);
        });

        zipFile.on('error', error => {
            return reject(error);
        });

        const writeStream = fs.createWriteStream(`${commonService.getActualFpath(dirPath, true)}${downloadName}`);
        zipFile.pipe(writeStream);

        async.eachLimit(arrFilesObj, 10, function (fileObj, next) {

            fs.readFile(`${commonService.getActualFpath(dirPath, true)}${fileObj.key}`, (err, data) => {
                if (err) {
                    logger.error(`Bulk download failed because of file not found ${err}`);
                    return reject(err);
                } else {
                    zipFile.append(data, { name: fileObj.name })
                    next();

                }
            });

        }, function (err) {
            if (err) {
                logger.error(`Get All files Error bulk download from local :: ${err}`);
                return reject(err);
            } else {
                zipFile
                    .finalize()
                    .then((response) => {
                        return resolve(`${localDownloadPath}/${downloadName}`);
                    })

            }
        });
    });
}
module.exports = WasabiServices = {
    uploadFile,
    uploadFileAsync,
    downloadFile,
    getSignedUrl,
    downloadZipFile,
    downloadZipFileLocal
};