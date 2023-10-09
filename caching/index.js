const crypto = require('crypto')

const redisClient = require('./redis')

const DEV = !(process.env.NODE_ENV == 'production')
const devCache = {}

const getCache = async (key,options = {}) => {
    const prefix = options.prefix || ''
    const hashKey = prefix + crypto.createHash('sha256').update(JSON.stringify(key)).digest('hex')
    if (DEV) {
        const now = new Date()
        if (devCache[hashKey] && devCache[hashKey].expire > now){
            return devCache[hashKey].data
        } else if (devCache[hashKey]){
            delete devCache[hashKey]
        }
        return null
    } else {
        const redis = await redisClient
        const cached = await redis.get(hashKey)
        if (cached) {
            const expire = await redis.ttl(hashKey)
            console.log('cached', expire+'sec', hashKey)
        }
        if (!cached) return null
        return cached
    }
}

const setCache = async (key,data,options={}) => {
    const expire = options.expire || 60*60 // 1h default
    const prefix = options.prefix || ''

    const hashKey = prefix + crypto.createHash('sha256').update(JSON.stringify(key)).digest('hex')

    if (DEV) {
        const ex = new Date(new Date().getTime() + (expire * 1000))
        devCache[hashKey] = {
            data,
            expire: ex
        }
        return true
    } else {
        const redis = await redisClient
        return await redis.setex(hashKey, expire, JSON.stringify(data))
    }

}

module.exports = {
    getCache,
    setCache
}
