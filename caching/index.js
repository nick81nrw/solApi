const crypto = require('crypto')

const devCache = {}

const DEV = !(process.env.NODE_ENV == 'production')


const getCache = async key => {
    const hashKey = crypto.createHash('sha256').update(JSON.stringify(key)).digest('hex')
    if (DEV) {
        const now = new Date()
        if (devCache[hashKey] && devCache[hashKey].expire > now){
            return devCache[hashKey].data
        } else if (devCache[hashKey]){
            delete devCache[hashKey]
        }
        return null
    } else {
        //TODO: Redis Cache
    }
}

const setCache = async (key,data,options={}) => {
    const hashKey = crypto.createHash('sha256').update(JSON.stringify(key)).digest('hex')
    const expire = options.expire || 10

    if (DEV) {
        const ex = new Date(new Date().getTime() + (expire * 1000))
        devCache[hashKey] = {
            data,
            expire: ex
        }
        return true
    } else {
        //TODO: Redis Cache
    }

}

module.exports = {
    getCache,
    setCache
}
