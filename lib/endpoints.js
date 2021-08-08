var sendJson = require('send-data/json')
var redis = require('./redis')
var body = require('body/json')

function removeRateById (rates, id, cb) {
  rates.forEach(function (rate, index) {
    var parsedRate = JSON.parse(rate)

    if (Number(parsedRate.id) === Number(id)) {
      redis.lrem('rates', 0, rates[index], function (err) {
        if (err) return cb(err)
      })
    }
  })
}

function getRateById (rates, id) {
  return rates.map((r) => JSON.parse(r)).find(r => Number(r.id) === Number(id))
}

function postTarget (req, res, opts, cb) {
  body(req, res, function (err, data) {
    if (err) return cb(err)

    redis.lrange('targets', 0, -1, function (err, targets) {
      if (err) return cb(err)
      if (targets.length > 0) {
        var result = targets.map(target => JSON.parse(target)).find(target => target.id === data.id)
        if (result) {
          res.statusCode = 403
          sendJson(req, res, { message: `Target with ${data.id} already exists` })
        } else {
          redis.rpush('targets', JSON.stringify(data), function (error, targets) {
            if (error) return cb(error)
            res.statusCode = 201
            sendJson(req, res, { data, message: 'success', status: 'OK' })
          })
        }
      } else {
        redis.rpush('targets', JSON.stringify(data), function (error, targets) {
          if (error) return cb(error)
          res.statusCode = 201
          sendJson(req, res, { data, message: 'success', status: 'OK' })
        })
      }
    })
  })
}

function fetchTargets (req, res, opts, cb) {
  redis.lrange('targets', 0, -1, function (err, targets) {
    if (err) return cb(err)
    if (targets.length > 0) {
      var results = targets.map(target => JSON.parse(target))
      res.statusCode = 200
      sendJson(req, res, { results, message: 'success', status: 'OK' })
    } else {
      res.statusCode = 404
      sendJson(req, res, { message: 'No targets!!' })
    }
  })
}

function getTarget (req, res, opts, cb) {
  var { params: { id } } = opts

  redis.lrange('targets', 0, -1, function (err, targets) {
    if (err) return cb(err)
    if (targets.length > 0) {
      var results = targets.map(target => JSON.parse(target)).filter(target => target.id === id)
      if (results.length > 0) {
        sendJson(req, res, { data: results[0], message: 'success', status: 'OK' })
      } else {
        res.statusCode = 404
        sendJson(req, res, { message: `Target with id ${id} not available` })
      }
    } else {
      res.statusCode = 404
      sendJson(req, res, { message: 'No targets!!' })
    }
  })
}

function updateTarget (req, res, opts, cb) {
  var { params: { id } } = opts
  body(req, res, function (err, data) {
    if (err) return cb(err)
    redis.lrange('targets', 0, -1, function (error, targets) {
      if (error) return cb(error)
      if (targets.length > 0) {
        var results = targets.map(target => JSON.parse(target)).filter(target => target.id === id)
        if (results.length > 0) {
          var result = results[0]

          // remove the target from the db
          targets.forEach(function (target, index) {
            if (target.id === result.id) {
              redis.lrem('targets', 0, JSON.stringify(targets[index]))
            }
          })

          //  updating the target
          var updatedTarget = { ...result, ...data }
          redis.rpush('targets', JSON.stringify(updatedTarget), function (err) {
            cb(err)
            sendJson(req, res, { message: 'success', data: updatedTarget })
          })
        } else {
          res.statusCode = 404
          sendJson(req, res, { message: `Target with id ${id} not available` })
        }
      } else {
        res.statusCode = 404
        sendJson(req, res, { message: 'No targets available!' })
      }
    })
  })
}

function postRoute (req, res, opts, cb) {
  body(req, res, function (err, data) {
    if (err) return cb(err)
    redis.lrange('targets', 0, -1, function (error, targets) {
      if (error) return cb(error)
      if (targets.length > 0) {
        var results = targets
          .map(target => JSON.parse(target))
          .filter(target => {
            var exists = false
            var keys = Object.keys(target.accept)
            for (var i = 0; i < keys.length; i++) {
              if (target.accept[keys[i]].$in.includes(data[keys[i]])) {
                exists = true
              }
            }
            return exists
          })

        if (results.length > 0) {
          var result = results.reduce(function (acc, curr) {
            return Number(acc.value) > Number(curr.value)
              ? acc
              : curr
          })

          redis.lrange('rates', 0, -1, function (err, rates) {
            if (err) return cb(err)
            var currentRate = getRateById(rates, result.id)

            // resting the count after 24hrs
            if (currentRate) {
              var now = new Date()
              var expiryTime = new Date(currentRate.expiryTime)

              if (now.getTime() > expiryTime.getTime() && currentRate.count === '0') {
              //  reset the count to the initial maxRequests of the target
                removeRateById(rates, currentRate.id, cb)

                // reducing the accepted request per day
                currentRate.count = String(Number(result.maxAcceptsPerDay) - 1)
                redis.rpush('rates', JSON.stringify(currentRate), function (err) {
                  if (err) return cb(err)
                })
              }
            }

            if (currentRate && currentRate.count === '0') {
              sendJson(req, res, { decision: 'reject' })
            } else {
              // storing the target ID and the counter for the maxRequests it allows
              var timestamp = new Date(data.timestamp)

              // setting the window for resetting the rate limit
              var expiry = new Date(timestamp.setDate(timestamp.getDate() + 1)).toISOString()
              var rate = {
                id: result.id,
                count: String(Number(result.maxAcceptsPerDay) - 1),
                initialRequestStartTime: data.timestamp,
                expiryTime: expiry
              }
              redis.lrange('rates', 0, -1, function (err, rates) {
                if (err) return cb(err)
                if (rates.length > 0) {
                  var currentRate = getRateById(rates, result.id)
                  if (!currentRate) {
                    redis.rpush('rates', JSON.stringify(rate), function (err) {
                      if (err) return cb(err)
                    })
                  } else {
                    //  removing the requested target from the db
                    removeRateById(rates, currentRate.id, cb)

                    // reducing the accepted request per day
                    currentRate.count = String(Number(currentRate.count) - 1)
                    redis.rpush('rates', JSON.stringify(currentRate), function (err) {
                      if (err) return cb(err)
                    })
                  }
                } else {
                  redis.rpush('rates', JSON.stringify(rate), function (err) {
                    if (err) return cb(err)
                  })
                }
              })
              sendJson(req, res, { url: result.url })
            }
          })
        } else {
          sendJson(req, res, { decision: 'reject' })
        }
      } else {
        sendJson(req, res, { decision: 'reject' })
      }
    })
  })
}

module.exports = {
  postRoute,
  postTarget,
  getTarget,
  fetchTargets,
  updateTarget
}
