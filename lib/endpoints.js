const sendJson = require('send-data/json')
const body = require('body/json')
const Db = require('./models/database')
const { fetchRate, fetchHighestValue } = require('./services/route')

function postTarget (req, res, opts, cb) {
  body(req, res, async function (err, data) {
    if (err) return cb(err)
    try {
      const target = await Db.getById('targets', data.id)
      if (target) {
        res.statusCode = 403
        sendJson(req, res, { message: `Target with ${data.id} already exists` })
      } else {
        await Db.save('targets', data)
        res.statusCode = 201
        sendJson(req, res, { data, message: 'success', status: 'OK' })
      }
    } catch (e) {
      cb(e)
    }
  })
}

async function fetchTargets (req, res, opts, cb) {
  try {
    const results = await Db.fetchAll('targets')
    if (results.length) {
      const resp = results.map(res => JSON.parse(res))
      res.statusCode = 200
      sendJson(req, res, { resp, message: 'success', status: 'OK' })
    } else {
      res.statusCode = 404
      sendJson(req, res, { message: 'No targets!!' })
    }
  } catch (e) {
    cb(e)
  }
}

async function getTarget (req, res, opts, cb) {
  try {
    const { params: { id } } = opts
    const target = await Db.getById('targets', id)
    if (!target) {
      res.statusCode = 404
      sendJson(req, res, { message: `Target with id ${id} not available` })
    } else {
      res.statusCode = 200
      sendJson(req, res, { target, message: 'success', status: 'OK' })
    }
  } catch (e) {
    cb(e)
  }
}

function updateTarget (req, res, opts, cb) {
  body(req, res, async function (err, data) {
    if (err) return cb(err)
    try {
      const { params: { id } } = opts
      const updatedData = await Db.update('targets', id, data)
      if (updatedData) {
        res.statusCode = 200
        sendJson(req, res, { message: 'success', data: updatedData })
      } else {
        res.statusCode = 404
        sendJson(req, res, { message: `Target with id ${id} not available` })
      }
    } catch (e) {
      cb(e)
    }
  })
}

function postRoute (req, res, opts, cb) {
  body(req, res, async function (err, data) {
    if (err) return cb(err)
    try {
      const target = await fetchHighestValue(data)
      const rate = await fetchRate(target, data)
      if (rate) {
        return sendJson(req, res, { url: target.url })
      }
      sendJson(req, res, { decision: 'reject' })
    } catch (e) {
      cb(e)
    }
  })
}

module.exports = {
  postRoute,
  postTarget,
  getTarget,
  fetchTargets,
  updateTarget
}
