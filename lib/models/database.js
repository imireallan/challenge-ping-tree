const { promisify } = require('util')
const redis = require('../redis')

class Db {
  static save (key, data) {
    try {
      const save = promisify(redis.rpush).bind(redis)
      return save(key, JSON.stringify(data))
    } catch (e) {
      console.log(e)
      throw e
    }
  }

  static fetchAll (key) {
    const fetch = promisify(redis.lrange).bind(redis)
    return fetch(key, 0, -1)
  }

  static async getById (key, id) {
    try {
      const results = await this.fetchAll(key)
      return results.length ? results.map(target => JSON.parse(target))
        .find(target => target.id === id) : undefined
    } catch (e) {
      console.log(e)
      throw e
    }
  }

  static async update (key, id, data) {
    try {
      const oldData = await this.delete(key, id)
      let newData
      if (oldData) {
        newData = { ...oldData, ...data }
        await this.save(key, newData)
      }
      return newData
    } catch (e) {
      console.log(e)
      throw e
    }
  }

  static async delete (key, id) {
    try {
      const remove = promisify(redis.lrem).bind(redis)
      const result = await this.getById(key, id)
      if (result) {
        await remove(key, 0, JSON.stringify(result))
      }
      return result
    } catch (e) {
      console.log(e)
      throw e
    }
  }
}

module.exports = Db
