const assert = require('assert');
const crypto = require('crypto');
const { doWhilst, series } = require('async');

const { scalityS3Client, awsS3Client } = require('../../../s3SDK');
const sharedBlobSvc = require('../../azureSDK');
const ReplicationUtility = require('../../ReplicationUtility');
const { makeGETRequest, getResponseBody } = require('../../../utils/request');

const scalityUtils = new ReplicationUtility(scalityS3Client, sharedBlobSvc);
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
const key = `${keyPrefix}/object-to-replicate-${Date.now()}`;
const destKeyPrefix = `${srcBucket}/${keyPrefix}`;

const REPLICATION_TIMEOUT = 300000;

function getAndCheckResponse(path, expected, cb) {
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
                let data = body[expected.type].results;
                if (typeof data.count !== 'number') {
                    data.count = parseFloat(data.count);
                    data.size = parseFloat(data.size);
                }
                const overExpected = (data.count > expected.maxCount ||
                    data.size > expected.maxSize);
                if (overExpected) {
                    return next(new Error('metrics data exceeds expected'));
                }
                const withinRange = (expected.minCount >= data.count &&
                    data.count <= expected.maxCount &&
                    expected.minSize >= data.size &&
                    data.size <= expected.maxSize);

                shouldContinue = !withinRange;
                if (shouldContinue) {
                    return setTimeout(next, 2000);
                }
                return next();
            });
        }),
    () => shouldContinue, cb);
}

describe('Backbeat replication metrics route validation', function dF() {
    this.timeout(REPLICATION_TIMEOUT);
    const pathPrefix = '/_/backbeat/api/metrics/crr';

    [
        `${pathPrefix}/all`,
        `${pathPrefix}/${destAWSLocation}`,
        `${pathPrefix}/${destAzureLocation}`,
    ].forEach(path => {
        it(`should return all metrics for path ${path}`, done => {
            makeGETRequest(path, (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                getResponseBody(res, (err, body) => {
                    assert.ifError(err);
                    const metricTypes = ['backlog', 'completions',
                        'throughput', 'failures'];
                    metricTypes.forEach(type => {
                        assert(body[type]);
                        assert(body[type].description);
                        assert(body[type].results);
                        const keys = Object.keys(body[type].results)
                        assert(keys.includes('count'));
                        assert(keys.includes('size'));
                    });
                    done();
                });
            });
        });
    });

    [
        `${pathPrefix}/all/backlog`,
        `${pathPrefix}/${destAWSLocation}/backlog`,
        `${pathPrefix}/${destAzureLocation}/backlog`,
        `${pathPrefix}/all/completions`,
        `${pathPrefix}/${destAWSLocation}/completions`,
        `${pathPrefix}/${destAzureLocation}/completions`,
        `${pathPrefix}/all/failures`,
        `${pathPrefix}/${destAWSLocation}/failures`,
        `${pathPrefix}/${destAzureLocation}/failures`,
        `${pathPrefix}/all/throughput`,
        `${pathPrefix}/${destAWSLocation}/throughput`,
        `${pathPrefix}/${destAzureLocation}/throughput`,
    ].forEach(path => {
        it(`should get responses for metric path: ${path}`,
        done => {
            makeGETRequest(path, (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                getResponseBody(res, (err, body) => {
                    const type = Object.keys(body)[0];
                    const data = body[type];
                    assert(data.description);
                    assert(data.results);
                    const resultKeys = Object.keys(data.results);
                    assert(resultKeys.includes('count'));
                    assert(resultKeys.includes('size'));
                    return done();
                });
            });
        });
    });
});

describe('Backbeat replication metrics data', function dF() {
    this.timeout(REPLICATION_TIMEOUT);
    const roleArn = 'arn:aws:iam::root:role/s3-replication-role';
    const storageClass = `${destAWSLocation},${destAzureLocation}`;
    const pathPrefix = '/_/backbeat/api/metrics/crr';

    beforeEach(done => series([
        next => scalityUtils.createVersionedBucket(srcBucket, next),
        next => scalityUtils.putBucketReplicationMultipleBackend(srcBucket,
            'placeholder', roleArn, storageClass, next),
    ], done));

    afterEach(done => series([
        next => scalityUtils.deleteAllBlobs(destContainer, destKeyPrefix, next),
        next => awsUtils.deleteAllVersions(awsDestBucket, destKeyPrefix, next),
        next => scalityUtils.deleteVersionedBucket(srcBucket, next),
    ], done));

    it('should report metrics when replication occurs', done => {
        let prevBacklog;
        let prevCompletions;
        let prevThroughput;
        series([
            next => makeGETRequest(`${pathPrefix}/all`, (err, res) => {
                assert.ifError(err);
                getResponseBody(res, (err, body) => {
                    assert.ifError(err);
                    prevBacklog = body.backlog.results;
                    prevCompletions = body.completions.results;
                    prevThroughput = body.throughput.results;
                    next();
                });
            }),
            // NOTE: metrics are doubled because 2 destination locations
            next => scalityUtils.putObject(srcBucket, key, Buffer.alloc(100),
                next),
            next => scalityUtils.waitUntilReplicated(srcBucket, key, undefined,
                next),
            next => {
                const minCount = prevCompletions.count + 2;
                const minSize = prevCompletions.size + 200;
                const expectedResult = {
                    type: 'completions',
                    minCount,
                    maxCount: minCount + prevBacklog.count,
                    minSize,
                    maxSize: minSize + prevBacklog.size,
                };
                // Just make sure completions has been incremented by given
                // sizes
                getAndCheckResponse(`${pathPrefix}/all/completions`,
                    expectedResult, next);
            },
            next => {
                const minCount = parseFloat(prevThroughput.count + (2 / 900));
                const minSize = parseFloat(prevThroughput.size + (200 / 900));
                const expectedResult = {
                    type: 'throughput',
                    minCount,
                    maxCount: minCount + parseFloat(prevBacklog.count),
                    minSize,
                    maxSize: minSize + parseFloat(prevBacklog.size),
                };
                // Just make sure completions has been incremented. We know if
                // completions matches, all other data should be as well
                getAndCheckResponse(`${pathPrefix}/all/throughput`,
                    expectedResult, next);
            },
        ], done);
    });
});
