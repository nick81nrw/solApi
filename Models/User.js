
const mongoose = require('mongoose')


const userSchema = mongoose.Schema({
    username: String,
    email: String,
    apiKey: String,
    created: {type: Date, default: Date.now()},
    accountType: {type: String, default: 'free'},
    active: {type: Boolean, default: true},
    passwortHash: String
})

const User = mongoose.model('User', userSchema)

const usage = {}



const setUsage = ({user,querystring}) => {
    if (!usage[user.username]) {
        usage[user.username] = [querystring]
    } else {
        usage[user.username].push(querystring)
    }
    return usage[user.username].length
}


module.exports = {
    User,
    setUsage,
}