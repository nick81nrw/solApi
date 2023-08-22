const bcrypt = require('bcrypt')

const {User} = require('../Models/User')

const oauthIssuers = require('../oauthIssuers')

const genApiKey = (len = 32) => {
    const chars = ['0','1','2','3','4','5','6','7','8','9',
    'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
    'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
    const key = [...Array(len)]
        .map(e => (chars[Math.floor(Math.random()*chars.length)]))
        .join('')
    return key
}



const createUser = async ({username, email, password}) => {
    const userExist = await User.findOne({$or:[{username},{email}]})
    if (userExist) return null

    const saltRound = 10

    const salt = await bcrypt.genSalt(saltRound)
    const passwortHash = await bcrypt.hash(password, salt)

    

    const newUser = new User({
        username,
        email,
        apiKey: genApiKey(),
        passwortHash
    })
    await newUser.save()
    return newUser
}

const loginUserByEmail = async (email, password) => {
    const user = await User.findOne({email})
    if (!user) return null
    const checkPassword = await bcrypt.compare(password, user.passwortHash)
    if (!checkPassword) return null
    return user
}
const getUserByApiKey = async (apiKey) => {
    const user = await User.findOne({apiKey})
    if (!user) return null
    return user
}

const getAcoountPage = (req,res) => {
    if (req.user || req.session.user) {
        res.render('pages/me', {user: req.user || req.session.user})
    } else {
        res.render('pages/createaccount')
    }
}

const getLoginPage = (req,res) => {
    if (req.session.user) {
        return res.redirect('/account')
    }
    const oauth = oauthIssuers.map(i => ({
        issuer: i.issuer,
        authUrl: i.createAuthUrl('abcde')
    }))

    res.render('pages/login',{oauth})
}


const login =  async (req,res) => {
    const {email, password} = req.body
    if (!(email && password)) return res.render('pages/login', {error:'email or password missing'})
    const user = await loginUserByEmail(email, password)
    if (!user) return res.render('pages/login', {error:'user not found or wrong password'})
    req.session.user = user
    res.render('pages/me', {user})
}

const createAccount = async (req,res) => {
    const {username, email, password} = req.body
    if(!(username && email && password)) return res.render('pages/createaccount', {error: 'username or email not given'})
    const newUser = await createUser({username, email, password})
    if (!newUser) return res.render('pages/createaccount', {error: 'account creation failed, user or email already exists'})
    req.session.user = newUser
    return res.redirect('/account')
    // return res.render('pages/me', {user:newUser})
}

const getOrCreateOauthUser = async ({username, email, access_token, token_type, oauthIssuer}) => {
    const user = await User.findOne({$or:[{username},{email}]})

    if (!user){
        const newUser = await new User({
            email,
            username,
            apiKey: genApiKey(),
            accountType: 'community',
            oauth: [{
                issuer: oauthIssuer,
                access_token,
                token_type
            }]
        }).save()

        return newUser
    }
    else if (user.username == username && user.email == email) {
        const oauthExists = user.oauth.filter(i => i == oauthIssuer)
        if (!oauthExists) {
            await user.oauth.push({
                issuer: oauthIssuer,
                access_token,
                token_type
            }).save()
        } else if (oauthExists.access_token != access_token) {
            //TODO: Renew Token
        }
        //TODO: set Token and Login User
        return user
    } else if (!(user.username == username && user.email == email)) return null

}

module.exports = {
    createUser,
    getOrCreateOauthUser,
    getUserByApiKey,
    loginUserByEmail,
    getAcoountPage,
    getLoginPage,
    login,
    createAccount

}