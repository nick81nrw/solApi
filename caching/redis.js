const { createClient } = require('async-redis')

const DEV = !(process.env.NODE_ENV == 'production')

const connectRedis = async () => {

    if (!DEV){
        const client = createClient({
            url: process.env.REDISCLIENT_URL
        });
        
        client.on('error', err => console.log('Redis Client Error', Object.keys(err)));
        
        return client
        
    } else {
        return null
    }

}

module.exports = connectRedis()