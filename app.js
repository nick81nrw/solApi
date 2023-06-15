const express = require('express')
const axios = require('axios')
const sunCalc = require('suncalc')
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./swagger.json')

const app = express()
const PORT = process.env.PORT || 5555


const calculateForcast = ({weatherData, power, tilt, azimuth, lat, lon, albedo, cellCoEff, powerInverter, inverterEfficiency}) => {

    const pvVectors = [
        Math.sin(azimuth/180*Math.PI) * Math.cos((90-tilt) / 180 * Math.PI),
        Math.cos(azimuth/180*Math.PI) * Math.cos((90-tilt) / 180 * Math.PI),
        Math.sin((90-tilt) / 180 * Math.PI),
    ]
    // console.log(pvVectors)
    const result = weatherData.time.map((time, idx) => {
        const dniRad = weatherData.direct_normal_irradiance[idx]
        const diffuseRad = weatherData.diffuse_radiation[idx]
        const shortwaveRad = weatherData.shortwave_radiation[idx]
        const temperature = weatherData.temperature_2m[idx]

        const t = new Date(time)
        const sunPos = sunCalc.getPosition(t, lat, lon)
        const sunAzimuth = sunPos.azimuth * 180 / Math.PI
        const sunTilt = sunPos.altitude * 180 / Math.PI
        sunVectors = [
            Math.sin(sunAzimuth/180*Math.PI) * Math.cos(sunTilt / 180 * Math.PI),
            Math.cos(sunAzimuth/180*Math.PI) * Math.cos(sunTilt / 180 * Math.PI),
            Math.sin(sunTilt / 180 * Math.PI),
        ]
        let efficiency = 0
        sunVectors.forEach((v,i) => {
            efficiency += v * pvVectors[i]
            
        })
        efficiency = efficiency <= 0 ? 0 : efficiency

        // TODO: Shading

        // TODO: Dynamic
        const shortwaveEfficiency = (0.5 - 0.5 * Math.cos(tilt/180 * Math.PI))

        const totalRadiationOnCell = dniRad * efficiency + diffuseRad * efficiency + shortwaveRad * shortwaveEfficiency * albedo
        const cellTemperature = calcCellTemperature(temperature, totalRadiationOnCell)
        // console.log({dniRad, diffuseRad, shortwaveRad, shortwaveEfficiency, totalRadiationOnCell, cellTemperature, power, temperature})

        const dcPower = totalRadiationOnCell / 1000 * power * (1 + (cellTemperature - 25) * (cellCoEff/100))

        const acPower = dcPower > powerInverter ? powerInverter * inverterEfficiency : dcPower * inverterEfficiency

        return {
            datetime: t,
            dcPower,
            power: acPower,
            cellTemperature,
            totalRadiationOnCell,
            efficiency,
            pvVectors,
            sunVectors,
            sunTilt,
            sunAzimuth,
            dniRad,
            diffuseRad,
            shortwaveRad,
            temperature,


        }

    })
    // console.log(sunCalc.getTimes(new Date(), lat, lon))
    // console.log(sunrisePos)
    // console.log(sunrisePos.azimuth * 180 / Math.PI)
    return result
}

const calcCellTemperature = (temperature, totalRadiotionOnCell) => {
    return temperature + 0.0342*totalRadiotionOnCell
}

app.get('/forecast', async (req,res) => {
    let {lat, lon, power, azimuth, tilt} = req.query
    if (!lat || !lon || !power || !azimuth || !tilt) return res.status(400).send({message: 'lat, lon, azimuth, tilt and power must given'})

    power = parseFloat(power)
    const albedo = req.query.albedo || 0.2
    const cellCoEff = req.query.cellCoEff || -0.4
    const powerInverter = req.query.powerInverter || power
    const inverterEfficiency = req.query.inverterEfficiency || 1
    const timezone = req.query.timezone || 'Europe/Berlin'

    const params = {
        latitude: lat,
        longitude: lon,
        hourly: 'temperature_2m,shortwave_radiation,diffuse_radiation,direct_normal_irradiance',
        forecast_days:1,
        timezone 

    }

    // https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&hourly=temperature_2m,shortwave_radiation,diffuse_radiation,direct_normal_irradiance&forecast_days=1
    // const response = await axios.get('https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&hourly=temperature_2m,shortwave_radiation,diffuse_radiation,direct_normal_irradiance&forecast_days=1')
    const response = await axios.get('https://api.open-meteo.com/v1/forecast',{params})

    const calculation = calculateForcast({lat,lon, weatherData: response.data.hourly, azimuth, tilt, cellCoEff, power, albedo, powerInverter, inverterEfficiency})
    // console.log(response)

    res.send(calculation)
})

app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument))


app.listen(PORT, ()=> console.log(`Server started on port ${PORT}`))