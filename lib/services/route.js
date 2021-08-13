const Db = require('../models/database')

const fetchHighestValue = async (data) => {
  const targets = await Db.fetchAll('targets')
  if (targets.length) {
    const fetchedTargts = targets
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
    return fetchedTargts.length ? fetchedTargts.reduce(function (acc, curr) {
      return Number(acc.value) > Number(curr.value)
        ? acc
        : curr
    }) : undefined
  }
}

const fetchRate = async (target, data) => {
  let shouldReturnRate
  if (target) {
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
      shouldReturnRate = false
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
        shouldReturnRate = true
      } else {
        //  removing the requested target from the db
        await Db.delete('rates', target.id)
        // reducing the accepted request per day
        rate.count = String(Number(rate.count) - 1)
        await Db.save('rates', rate)
        shouldReturnRate = true
      }
    }
  }
  return shouldReturnRate
}

module.exports = {
  fetchRate,
  fetchHighestValue
}
