const express = require('express')
const sessions = require('express-session')
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./swagger.json')

const app = express()
const PORT = process.env.PORT || 5555

require('./Models/db')
const {routeGetPrices} = require('./prices')
const {routePvGeneration} = require('./pvGeneration')
const {routeCalcProfile} = require('./SLP')
const { getAcoountPage, getLoginPage, login, createAccount, getUserByApiKey } = require('./controller/userController')
const { oauthCallback } = require('./controller/oauthController')

app.set('view engine', 'ejs')

app.use(express.json())
app.use(express.urlencoded({extended:false}))

app.use(sessions({
    secret: process.env.SESSION_SECRET || [...Array(30)].map(x => Math.floor(Math.random()*10)).join(''),
    cookie: {maxAge:1000*60*60*24},
    resave: false,
    saveUninitialized: true
}))

app.use(async (req,res,next)=> {
    console.log(req.session)
    const apikey = req.query.apikey || req.header("x-api-key")
    if (apikey) {
        const user = await getUserByApiKey(apikey)
        if (user) {
            req.accountType = user.accountType
            // req.usageToday = setUsage({user, querystring:req.query})
        } else {
            return res.send({error: 'apikey not fund'}).status(403)
        }
    } else {
        req.accountType = 'anonymous'
    }

    next()
})

// check rights in route as middleware... app.get('/prices', rights('paid'), routeGetPrices)
const rights = types => (req,res,next) => {
    const rightsOrder = ['anonymous', 'free', 'community', 'paid', 'admin']
    const checkRights = Array.isArray(types) ? types : [types]
    if (checkRights.indexOf(req.accountType) >= 0) return next()
    const minRequiredRights = checkRights.reduce((acc,curr) => rightsOrder.indexOf(curr) > acc ? curr : acc ,-1)
    if (rightsOrder.indexOf(minRequiredRights) <= rightsOrder.indexOf(req.accountType)) return next()
    return res.status(403).send({error: `Ressource not allowed in account type ${req.accountType}`})
}

app.get(['/forecast', '/archive'], routePvGeneration)
app.get('/prices', routeGetPrices)
app.get('/defaultloadprofile', routeCalcProfile)

app.post('/account',createAccount)
app.get('/account/callback', oauthCallback)
app.get('/account/', getAcoountPage)
app.get('/login/', getLoginPage)
app.post('/login/',login)

app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument))


app.listen(PORT, ()=> console.log(`Server started on port ${PORT}`))
