const express = require('express')
const axios = require('axios')
const sunCalc = require('suncalc')
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./swagger.json')

const app = express()
const PORT = process.env.PORT || 5555

const {routeGetPrices} = require('./prices')
const {routePvGeneration} = require('./pvGeneration')
const {routeCalcProfile} = require('./SLP')



app.get(['/forecast', '/archive'], routePvGeneration)
app.get('/prices', routeGetPrices)
app.get('/defaultloadprofile', routeCalcProfile)

app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument))


app.listen(PORT, ()=> console.log(`Server started on port ${PORT}`))