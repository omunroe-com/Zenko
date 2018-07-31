const assert = require('assert');
const crypto = require('crypto');
const { parallel, series } = require('async');

const { scalityS3Client, awsS3Client } = require('../../s3SDK');
const sharedBlobSvc = require('../../azureSDK');
const gcpStorage = require('../../gcpStorage');
const ReplicationUtility = require('../../ReplicationUtility');
const { makeGETRequest, getResponseBody } = require('../../utils/request');

const scalityUtils =
    new ReplicationUtility(scalityS3Client, sharedBlobSvc);
const awsUtils = new ReplicationUtility(awsS3Client);

const srcBucket = `source-bucket-${Date.now()}`;
const awsDestBucket = process.env.AWS_S3_BACKBEAT_BUCKET_NAME;
const destContainer = process.env.AZURE_BACKBEAT_CONTAINER_NAME;
const destAWSLocation = process.env.AWS_S3_BACKEND_DESTINATION_LOCATION;
const destAzureLocation = process.env.AZURE_BACKEND_DESTINATION_LOCATION;
const hex = crypto.createHash('md5')
    .update(Math.random().toString())
    .digest('hex');
const keyPrefix = `${srcBucket}/${hex}`;
const destKeyPrefix = `${srcBucket}/${keyPrefix}`;
const key = `${keyPrefix}/object-to-replicate-${Date.now()}`;

const REPLICATION_TIMEOUT = 300000;

// Delay the get request to make sure redis is populated
function makeDelayedGETRequest(endpoint, cb) {
    setTimeout(() => {
        makeGETRequest(endpoint, cb);
    }, 5000);
}

function getAndCheckResponse(path, expectedBody, cb) {
    let shouldContinue = false;
    return doWhilst(next =>
        makeGETRequest(path, (err, res) => {
            if (err) {
                return next(err);
            }
            assert.strictEqual(res.statusCode, 200);
            getResponseBody(res, (err, body) => {
                if (err) {
                    return next(err);
                }
                shouldContinue =
                    JSON.stringify(body) !== JSON.stringify(expectedBody);
                if (shouldContinue) {
                    return setTimeout(next, 2000);
                }
                return next();
            });
        }),
    () => shouldContinue, cb);
}

describe.only('Backbeat replication metrics', function dF() {
    this.timeout(REPLICATION_TIMEOUT);
    const roleArn = 'arn:aws:iam::root:role/s3-replication-role';
    const storageClass = `${destAWSLocation},${destAzureLocation}`;

    beforeEach(done => series([
        next => scalityUtils.createVersionedBucket(srcBucket, next),
        next => scalityUtils.putBucketReplicationMultipleBackend(srcBucket,
            'placeholder', roleArn, storageClass, next),
    ], done));

    afterEach(done => parallel([
        next => scalityUtils.deleteVersionedBucket(srcBucket, next),
        next => awsUtils.deleteAllVersions(awsDestBucket, destKeyPrefix, next),
        next => scalityUtils.deleteAllBlobs(destContainer, destKeyPrefix, next),
    ], done));

    [
        '/_/backbeat/api/metrics/crr/all',
        `/_/backbeat/api/metrics/crr/${destAWSLocation}`,
        `/_/backbeat/api/metrics/crr/${destAzureLocation}`,
    ].forEach(path => {
        it(`should return all metrics for path ${path}`, done => {
            makeGETRequest(`/_/backbeat/api/metrics/crr/${destLocation}`,
            (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                getResponseBody(res, (err, body) => {
                    assert.ifError(err);
                    const metricTypes = ['backlog', 'completions',
                        'throughput', 'failures'];
                    const keys = Object.keys(body);
                    keys.forEach(key => {
                        assert(metricTypes.includes(key));
                        assert(body[key].description);
                        assert(body[key].results);
                        const resultKeys = Object.keys(body[key].results);
                        assert(resultKeys.includes('count'));
                        assert(resultKeys.includes('size'));
                    });
                    done();
                });
            });
        });
    });

    [
        '/_/backbeat/api/metrics/crr/all/backlog',
        `/_/backbeat/api/metrics/crr/${destAWSLocation}/backlog`,
        '/_/backbeat/api/metrics/crr/all/completions',
        '/_/backbeat/api/metrics/crr/all/failures',
        '/_/backbeat/api/metrics/crr/all/throughput',
    ].forEach(path => {
        it(`should get correctly formatted response for metric path: ${path}`,
        done => {
            makeGETRequest(entry.path, (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                getResponseBody(res, (err, body) => {
                    const type = Object.keys(res);
                    const data = res[type];
                    assert(data.description);
                    assert(data.result);
                    const resultKeys = Object.keys(data.result);
                    assert(resultKeys.includes('count'));
                    assert(resultKeys.includes('size'));
                    return done()
                });
            });
        });
    });

    it('should report metrics when replication occurs', done => {
        let prevDataOps;
        let prevDataBytes;
        series([
            next => makeGETRequest('/_/backbeat/api/metrics/crr/all',
                (err, res) => {
                    assert.ifError(err);
                    getResponseBody(res, (err, body) => {
                        assert.ifError(err);
                        prevDataOps = body.backlog.results.count +
                            body.completions.results.count;
                        prevDataBytes = body.backlog.results.size +
                            body.completions.results.size;
                        console.log('prevDataOps:', prevDataOps);
                        console.log('prevDataBytes:', prevDataBytes);
                        next();
                    });
                }),
            next => scalityUtils.putObject(srcBucket, key, Buffer.alloc(100),
                next),
            next => scalityUtils.compareObjectsAWS(srcBucket, awsDestBucket,
                key, undefined, next),
            next => makeDelayedGETRequest('/_/backbeat/api/metrics/crr/all',
                (err, res) => {
                    assert.ifError(err);
                    getResponseBody(res, (err, body) => {
                        assert.ifError(err);
                        // Backlog + Completions = replicated object
                        const opResult = body.backlog.results.count +
                            body.completions.results.count;
                        console.log('opResult:', opResult);
                        assert(opResult - prevDataOps === 1);
                        const byteResult = body.backlog.results.size +
                            body.completions.results.size;
                        console.log('byteResult:', byteResult);
                        assert(byteResult - prevDataBytes === 100);

                        const throughputSize = body.throughput.results.size;
                        assert(throughputSize > 0);
                        next();
                    });
                }),
        ], done);
    });

    it('should get bucket-level throughput metrics', done => {
        let versionId;
        const destinationKey = `${srcBucket}/${key}`;

        series([
            next => scalityUtils.putObject(srcBucket, key, Buffer.alloc(10000),
                (err, res) => {
                    assert.ifError(err);
                    versionId = res.VersionId;
                    next();
                }),
            next => scalityUtils.compareObjectsAWS(srcBucket, awsDestBucket, key,
                undefined, next),
            next => makeDelayedGETRequest('/_/backbeat/api/metrics/crr/' +
                `${destLocation}/throughput/${awsDestBucket}/${destinationKey}` +
                `?versionId=${versionId}`,
                (err, res) => {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 200);

                    getResponseBody(res, (err, body) => {
                        assert.ifError(err);
                        assert(body.description);
                        assert(body.throughput);

                        next();
                    });
                }),
        ], done);
    });
});
