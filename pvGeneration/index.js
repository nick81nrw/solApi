const axios = require('axios')
const sunCalc = require('suncalc')
const moment = require('moment-timezone')

const validate = require('./validation')

const megreArraysUnique = (...all) => {
    let newArr = []
    for (const arr of all) {
        newArr = [...newArr, ...arr]
    }
    return newArr.filter( (val, i) => {
        return newArr.indexOf(val) == i
    })

}

const calculateForcast = ({weatherData, power, tilt, azimuth, lat, lon, albedo, cellCoEff, powerInvertor, invertorEfficiency, DEBUG, additionalRequestData, horizont, summary, timezone}) => {

    const pvVectors = [
        Math.sin(azimuth/180*Math.PI) * Math.cos((90-tilt) / 180 * Math.PI),
        Math.cos(azimuth/180*Math.PI) * Math.cos((90-tilt) / 180 * Math.PI),
        Math.sin((90-tilt) / 180 * Math.PI),
    ]

    const dataTimeline = weatherData && weatherData.minutely_15 ? weatherData.minutely_15 :  weatherData.hourly

    if (!dataTimeline) return []

    const values = dataTimeline.time.map((time, idx) => {
        const dniRad = dataTimeline.direct_normal_irradiance[idx]
        const diffuseRad = dataTimeline.diffuse_radiation[idx]
        const shortwaveRad = dataTimeline.shortwave_radiation[idx]
        const temperature = dataTimeline.temperature_2m[idx]

        const t = new Date(time)
        
        const localTime = new Date(t.getTime() - t.getTimezoneOffset() * 60000)
        const sunPosTime = weatherData.minutely_15 ? new Date(new Date(t).setMinutes(7)) : new Date(new Date(t).setMinutes(30)) // mid of time slot
        const sunPos = sunCalc.getPosition(sunPosTime, lat, lon)
        const sunAzimuth = sunPos.azimuth * 180 / Math.PI
        const sunTilt = sunPos.altitude * 180 / Math.PI
        const sunVectors = [
            Math.sin(sunAzimuth/180*Math.PI) * Math.cos(sunTilt / 180 * Math.PI),
            Math.cos(sunAzimuth/180*Math.PI) * Math.cos(sunTilt / 180 * Math.PI),
            Math.sin(sunTilt / 180 * Math.PI),
        ]

        let efficiency = 0

        sunVectors.forEach((v,i) => {
            efficiency += v * pvVectors[i]
            
        })
        efficiency = efficiency <= 0 ? 0 : efficiency

        // Shading
        if (horizont && efficiency > 0) {
            const horizontVal = horizont.find(h => sunAzimuth >= h.azimuthFrom && sunAzimuth < h.azimuthTo)
            if (!horizontVal) return
            if (horizontVal.altitude > sunTilt) {
                efficiency = efficiency * horizontVal.transparency || 0
            }
        }
        // TODO: Dynamic
        const shortwaveEfficiency = (0.5 - 0.5 * Math.cos(tilt / 180 * Math.PI))
        const diffuseEfficiency =   (0.5 + 0.5 * Math.cos(tilt / 180 * Math.PI))

        const totalRadiationOnCell = dniRad * efficiency + diffuseRad * diffuseEfficiency + shortwaveRad * shortwaveEfficiency * albedo
        const cellTemperature = calcCellTemperature(temperature, totalRadiationOnCell)
        
        const dcPowerComplete = totalRadiationOnCell / 1000 * power * (1 + (cellTemperature - 25) * (cellCoEff/100))
        const dcPower = weatherData.minutely_15 ? dcPowerComplete /4 : dcPowerComplete
        const acPowerComplete = dcPowerComplete > powerInvertor ? powerInvertor * invertorEfficiency : dcPowerComplete * invertorEfficiency
        const acPower = weatherData.minutely_15 ? acPowerComplete /4 : acPowerComplete

        const calcResult = {
            datetime: localTime,
            dcPower,
            power: acPower,
            sunTilt,
            sunAzimuth,
            temperature,
        }
        if (additionalRequestData.length > 0) {
            additionalRequestData.forEach(elem => {
                calcResult[elem] = dataTimeline[elem][idx]
            })
        }
        if (DEBUG) {
            calcResult.dniRad = dniRad,
            calcResult.diffuseRad = diffuseRad
            calcResult.shortwaveRad = shortwaveRad
            calcResult.cellTemperature = cellTemperature
            calcResult.totalRadiationOnCell = totalRadiationOnCell
            calcResult.efficiency = efficiency
            calcResult.pvVectors = pvVectors
            calcResult.sunVectors = sunVectors
            calcResult.sunPos = sunPos
            calcResult.sunPosTimeUtc = sunPosTime
            calcResult.utcTime = t
        }
        if (DEBUG && horizont) calcResult.horizont = horizont

        return calcResult

    })

    if (weatherData.minutely_15) {

        const summaryObject = values.reduce((prev, curr) => {
            const key = new Date(new Date(curr.datetime).setMinutes(0)).toISOString()
            if (!prev[key]) {
                prev[key] = {
                    datetime: key,
                    dcPower: curr.dcPower,
                    power: curr.power,
                }
                return prev
            }
            prev[key].dcPower += curr.dcPower
            prev[key].power += curr.power
            return prev

        },{})
        
        const summary = Object.values(summaryObject)

        return {values, summary}

    }

    return {values}
}

const calcCellTemperature = (temperature, totalRadiotionOnCell) => {
    return temperature + 0.0342*totalRadiotionOnCell
}

const parseHorizont = (horizontString => {
    //TODO: validate input

    const horizontArr = horizontString.split(',')

    const horizont = horizontArr.map((elem, i, idx) => {
        const azimuthFrom = ((360 / idx.length) * i)-180
        const azimuthTo = ((360 / idx.length) * (1+i))-180

        if (typeof elem == 'number') return {altitude:elem, azimuthFrom,azimuthTo}
        if (elem.includes('t')) {
            const [altitude, transparency] = elem.split('t')
            //TODO: check input 0..1
            return { altitude: parseFloat(altitude), transparency: parseFloat(transparency), azimuthFrom,azimuthTo}
        }
        return {altitude: parseFloat(elem), azimuthFrom,azimuthTo}
        })

    return horizont
        
})



const routePvGeneration = async (req,res) => {
    
    const lat = validate.lat(req.query.lat)
    const lon = validate.lon(req.query.lon)
    const power = validate.power(req.query.power)
    const azimuth = validate.azimuth(req.query.azimuth)
    const tilt = validate.tilt(req.query.tilt)
    const wrongParameters = [{lat},{lon},{power},{azimuth},{tilt}].map(p => Object.values(p)[0] ? false : ({[Object.keys(p)[0]]:req.query[Object.keys(p)[0]]})).filter(p => p !== false)
    if (!lat || !lon || !power || !azimuth || !tilt) return res.status(400).send({message: 'lat, lon, azimuth, tilt and power must given and valid',wrongParameters})
    
    // TODO: Timezone
    const albedo = validate.albedo(req.query.albedo) || 0.2
    const cellCoEff = validate.cellCoEff(req.query.cellCoEff) || -0.4
    const powerInvertor = validate.powerInvertor(req.query.powerInvertor) || power
    const invertorEfficiency = validate.invertorEfficiency(req.query.invertorEfficiency) || 1
    const timezone = req.query.timezone || 'Europe/Berlin'
    const past_days = validate.past_days(req.query.past_days) || 0
    const horizont = req.query.horizont && parseHorizont(req.query.horizont) || null
    const additionalRequestData = req.query.hourly && req.query.hourly.split(',') || []
    const timeCycle = validate.timeCycle(req.query.timecycle) || 'hourly'
    const summary = validate.summary(req.query.summary) || 'hourly'
    const start_date = past_days > 0 && validate.start_date(req.query.start_date) || false
    const end_date = past_days > 0 &&  validate.end_date(req.query.end_date) || false
    const DEBUG = !!((req.query.debug ||req.query.DEBUG)  || false)

    
    const requestData = ['temperature_2m','shortwave_radiation','diffuse_radiation','direct_normal_irradiance']
    let weatherRequestUrl = ''
    let params = {}
    let meta = {}

    const baseMeta = {
        lat,
        lon,
        power,
        azimuth,
        tilt,
        timezone,
        albedo,
        past_days,
        invertorEfficiency,
        powerInvertor,
        cellCoEff
    }

    if (horizont) baseMeta.horizont = horizont
    if (horizont) baseMeta.horizontString = req.query.horizont


    const baseParams = {
        latitude: lat,
        longitude: lon,
        [timeCycle]: megreArraysUnique(requestData,additionalRequestData).join(','),
        timezone,
    }
    


    if (req.path == '/forecast') {

        params = {...baseParams,past_days}
        meta = {...baseMeta, past_days}
        weatherRequestUrl = 'https://api.open-meteo.com/v1/dwd-icon'
    
        
        
    } else if (req.path == '/archive') {
        const yesterday = new Date(new Date() - (1 * 24 * 60 * 60 * 1000))
        const lastWeek = new Date(yesterday - (7 * 24 * 60 *60 * 1000))
        
        yesterdayString = `${yesterday.getFullYear()}-${("0" + (yesterday.getMonth()+1)).slice(-2)}-${("0" + yesterday.getDate()).slice(-2)}`
        lastWeekString = `${lastWeek.getFullYear()}-${("0" + (lastWeek.getMonth()+1)).slice(-2)}-${("0" + lastWeek.getDate()).slice(-2)}`
        
        const start = start_date ? start_date : lastWeekString
        const end = end_date ? end_date : yesterdayString
        
        meta = {...baseMeta,start_date: start, end_date: end}
        params = {...baseParams, start_date: start, end_date: end}
        
        weatherRequestUrl = 'https://archive-api.open-meteo.com/v1/archive'

        
    } else {
        res.status(400).send({error:true})
    }

    try {
        console.log(params)
        const response = await axios.get(weatherRequestUrl,{params})
        
        const values = calculateForcast({lat,lon, weatherData: response.data, azimuth, tilt, cellCoEff, power, albedo, powerInvertor, invertorEfficiency, DEBUG, additionalRequestData, horizont, summary, timezone})
        res.send({meta, ...values})
    } catch(e) {
        console.log(e)
        res.status(500).send(e.message)
    }
    
    
}

module.exports = {
    calcCellTemperature,
    calculateForcast,
    routePvGeneration,
    megreArraysUnique
}
