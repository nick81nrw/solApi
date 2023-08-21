const mongoose = require('mongoose')

mongoose.set("strictQuery", false);

const mongoDB = process.env.MONGOBD_CONNECTION || 'mongodb://127.0.0.1:27017/test'

mongoose.connect(mongoDB)

// module.exports = {mongoose}