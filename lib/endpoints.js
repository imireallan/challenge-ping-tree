const sendJson = require('send-data/json')
const body = require('body/json')
const Db = require('./models/database')

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
      const targets = await Db.fetchAll('targets')
      if (targets.length) {
        const results = targets
          .map(target => JSON.parse(target))
          .filter(target => {
            let exists = false
            const keys = Object.keys(target.accept)
            for (let i = 0; i < keys.length; i++) {
              if (target.accept[keys[i]].$in.includes(data[keys[i]])) {
                exists = true
              }
            }
            return exists
          })

        if (results.length) {
          const target = results.reduce(function (acc, curr) {
            return Number(acc.value) > Number(curr.value)
              ? acc
              : curr
          })
          const rate = await Db.getById('rates', target.id)

          // resetting the count after 24hrs
          if (rate) {
            const now = new Date()
            const expiryTime = new Date(rate.expiryTime)
            if (now.getTime() > expiryTime.getTime() && rate.count === '0') {
              //  reset the count to the initial maxRequests of the target
              await Db.delete('rates', rate.id)

              // reducing the accepted request per day
              rate.count = String(Number(target.maxAcceptsPerDay) - 1)

              await Db.save('rates', rate)
            }
          }
          if (rate && rate.count === '0') {
            sendJson(req, res, { decision: 'reject' })
          } else {
            // storing the target ID and the counter for the maxRequests it allows
            const timestamp = new Date(data.timestamp)

            // setting the window for resetting the rate limit
            const expiry = new Date(timestamp.setDate(timestamp.getDate() + 1)).toISOString()

            const rateData = {
              id: target.id,
              count: String(Number(target.maxAcceptsPerDay) - 1),
              initialRequestStartTime: data.timestamp,
              expiryTime: expiry
            }

            const existingRate = await Db.getById('rates', target.id)
            if (!existingRate) {
              await Db.save('rates', rateData)
              sendJson(req, res, { url: target.url })
            } else {
              //  removing the requested target from the db
              await Db.delete('rates', target.id)
              // reducing the accepted request per day
              rate.count = String(Number(rate.count) - 1)
              await Db.save('rates', rate)
              sendJson(req, res, { url: target.url })
            }
          }
        } else {
          sendJson(req, res, { decision: 'reject' })
        }
      } else {
        sendJson(req, res, { decision: 'reject' })
      }
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
