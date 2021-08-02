var sendJson = require('send-data/json');
var redis = require('./redis');
var body = require('body/json');

function postTarget(req, res, opts, cb) {
    body(req, res, function (err, data) {
        if (err) return cb(err);
        redis.rpush('targets', JSON.stringify(data), function (error, targets) {
            if (error) return cb(error);
            res.statusCode = 201;
            sendJson(req, res, { ...data, message: 'success' });
            cb();
        });
    });
}

function fetchTargets(req, res, opts, cb) {
    redis.lrange('targets', 0, -1, function (err, targets) {
        if (err) return cb(err);
        if (targets.length > 0) {
            var results = targets.map(target => JSON.parse(target));
            sendJson(req, res, results);
        } else {
            res.statusCode = 404;
            sendJson(req, res, { message: 'No targets!!' });
        }
        cb();
    });
}

function getTarget(req, res, opts, cb) {}

function updateTarget(req, res, opts, cb) {}

function postRoute(req, res, opts, cb) {
    body(req, res, function (err, data) {
        if (err) return cb(err);
        redis.lrange('targets', 0, -1, function (error, targets) {
            if (error) return cb(error);
            if (targets.length > 0) {
                var results = targets
                    .map(target => JSON.parse(target))
                    .filter(target =>
                        target.accept.geoState.$in.includes(data.geoState)
                    );

                if (results.length > 0) {
                    var result = results.reduce(function (acc, curr) {
                        return Number(acc.value) > Number(curr.value)
                            ? acc
                            : curr;
                    });
                    sendJson(req, res, { url: result.url });
                } else {
                    sendJson(req, res, { decision: 'reject' });
                }
            } else {
                sendJson(req, res, { decision: 'reject' });
            }
        });
    });
}

module.exports = {
    postRoute,
    postTarget,
    getTarget,
    fetchTargets,
    updateTarget,
};
