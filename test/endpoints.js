process.env.NODE_ENV = 'test'

var test = require('ava')
var servertest = require('servertest')
var server = require('../lib/server')
var redis = require('../lib/redis')

var mockTargetData
var mockRoutePayload

test.beforeEach(function (t) {
  mockTargetData = {
    id: '10',
    url: 'http://example10.com',
    value: '1.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }

  mockRoutePayload = {
    geoState: 'ca',
    publisher: 'abc',
    timestamp: '2018-07-19T23:28:59.513Z'
  }
})

test.afterEach.always.cb(function (t) {
  redis.flushdb(function (err) {
    t.falsy(err)
    t.end()
  })
  mockRoutePayload = {}
  mockTargetData = {}
})

test.serial.cb('healthcheck', function (t) {
  var url = '/health'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.end()
  })
})

test.serial.cb('postTargets - cannot POST a target that already exists', function (t) {
  var url = '/api/targets'
  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 403, 'correct status code')
      t.is(res.body.message, `Target with ${mockTargetData.id} already exists`, 'correct message')
      t.end()
    }).end(JSON.stringify(mockTargetData))
  }).end(JSON.stringify(mockTargetData))
})

test.serial.cb('postTargets - can POST a target', function (t) {
  var url = '/api/targets'
  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 201, 'correct status code')
    t.is(res.body.message, 'success', 'correct message')
    t.end()
  }).end(JSON.stringify(mockTargetData))
})

test.serial.cb('fetchTargets when target list is empty', function (t) {
  var url = '/api/targets'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 404, 'correct statusCode')
    t.is(res.body.message, 'No targets!!', 'correct message')
    t.end()
  })
})

test.serial.cb('fetchTargets', function (t) {
  var url = '/api/targets'
  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    servertest(server(), url, { encoding: 'json' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 200, 'correct statusCode')
      t.is(res.body.message, 'success', 'correct message')
      t.is(res.body.status, 'OK', 'correct status')
      t.end()
    })
  }).end(JSON.stringify(mockTargetData))
})

test.serial.cb('postRoute return url if target exists', function (t) {
  var url = '/api/targets'
  var url2 = '/route'

  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    servertest(server(), url2, { encoding: 'json', method: 'POST' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 200, 'correct status code')
      t.is(res.body.url, 'http://example10.com', 'correct url')
      t.end()
    }).end(JSON.stringify(mockRoutePayload))
  }).end(JSON.stringify(mockTargetData))
})

test.serial.cb('postRoute rejects request if target does not accept the provided geoState', function (t) {
  var url = '/api/targets'
  var url2 = '/route'
  var payload = {
    geoState: 'c',
    publisher: 'abc',
    timestamp: '2018-07-19T23:28:59.513Z'
  }

  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    servertest(server(), url2, { encoding: 'json', method: 'POST' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 200, 'correct status code')
      t.is(res.body.decision, 'reject', 'correct decision')
      t.end()
    }).end(JSON.stringify(payload))
  }).end(JSON.stringify(mockTargetData))
})

test.serial.cb('postRoute - rejects request when there are no targets', function (t) {
  var url = '/route'
  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'correct status code')
    t.is(res.body.decision, 'reject', 'correct decision')
    t.end()
  }).end(JSON.stringify(mockRoutePayload))
})

test.serial.cb('postRoute returns target with the highest value', function (t) {
  var url = '/api/targets'
  var url2 = '/route'

  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
      t.falsy(err, 'no error')
      servertest(server(), url2, { encoding: 'json', method: 'POST' }, function (err, res) {
        t.falsy(err, 'no error')
        t.is(res.statusCode, 200, 'correct status code')
        t.is(res.body.url, 'http://example.com', 'correct decision')
        t.end()
      }).end(JSON.stringify(mockRoutePayload))
    }).end(JSON.stringify(mockTargetData))
  }).end(JSON.stringify({ ...mockTargetData, value: '10.05', url: 'http://example.com' }))
})

test.serial.cb('geTarget - should return a target given an id', function (t) {
  var url = '/api/targets'
  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    servertest(server(), '/api/target/10', { encoding: 'json' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 200, 'correct statusCode')
      t.is(res.body.message, 'success', 'correct message')
      t.is(res.body.data.id, mockTargetData.id, 'correct status')
      t.end()
    })
  }).end(JSON.stringify(mockTargetData))
})

test.serial.cb('geTarget - should return "not targets" when targets is empty', function (t) {
  servertest(server(), '/api/target/1', { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 404, 'correct statusCode')
    t.is(res.body.message, 'No targets!!', 'correct message')
    t.end()
  })
})

test.serial.cb('geTarget - should return an error while fetching a non-existent target', function (t) {
  var url = '/api/targets'
  var id = 1
  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    servertest(server(), `/api/target/${id}`, { encoding: 'json' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 404, 'correct statusCode')
      t.is(res.body.message, `Target with id ${id} not available`, 'correct message')
      t.end()
    })
  }).end(JSON.stringify(mockTargetData))
})

test.serial.cb('updateTarget - should return an error if no targets', function (t) {
  var id = 1
  servertest(server(), `/api/target/${id}`, { encoding: 'json', method: 'PUT' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 404, 'correct statusCode')
    t.is(res.body.message, 'No targets available!', 'correct message')
    t.end()
  }).end(JSON.stringify({ value: 10 }))
})

test.serial.cb('updateTarget - should return an error if the "id" passed returns no target', function (t) {
  var url = '/api/targets'
  var id = 1
  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    servertest(server(), `/api/target/${id}`, { encoding: 'json', method: 'PUT' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 404, 'correct statusCode')
      t.is(res.body.message, `Target with id ${id} not available`, 'correct message')
      t.end()
    }).end(JSON.stringify({ value: 10 }))
  }).end(JSON.stringify(mockTargetData))
})

test.serial.cb('updateTarget - should update a target', function (t) {
  var url = '/api/targets'
  var id = 10
  var updateUrl = 'http://localhost/newUrl'
  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    servertest(server(), `/api/target/${id}`, { encoding: 'json', method: 'PUT' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 200, 'correct statusCode')
      t.is(res.body.data.url, updateUrl, 'correct url')
      t.end()
    }).end(JSON.stringify({ url: updateUrl }))
  }).end(JSON.stringify(mockTargetData))
})
