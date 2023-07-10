const axios = require('axios')
const sunCalc = require('suncalc')

const megreArraysUnique = (...all) => {
    let newArr = []
    for (const arr of all) {
        newArr = [...newArr, ...arr]
    }
    return newArr.filter( (val, i) => {
        return newArr.indexOf(val) == i
    })

}

const calculateForcast = ({weatherData, power, tilt, azimuth, lat, lon, albedo, cellCoEff, powerInvertor, invertorEfficiency, DEBUG, additionalRequestData}) => {

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
        const sunPosTime = weatherData.minutely_15 ? new Date(new Date(t).setMinutes(7)) : new Date(new Date(t).setMinutes(30)) // mid of time slot
        const sunPos = sunCalc.getPosition(sunPosTime, lat, lon)
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
        
        const dcPowerComplete = totalRadiationOnCell / 1000 * power * (1 + (cellTemperature - 25) * (cellCoEff/100))
        const dcPower = weatherData.minutely_15 ? dcPowerComplete /4 : dcPowerComplete
        const acPowerComplete = dcPowerComplete > powerInvertor ? powerInvertor * invertorEfficiency : dcPowerComplete * invertorEfficiency
        const acPower = weatherData.minutely_15 ? acPowerComplete /4 : acPowerComplete

        const calcResult = {
            datetime: t,
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
            calcResult.sunPosTime = sunPosTime
        }

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

const routePvGeneration = async (req,res) => {
    
    let {lat, lon, power, azimuth, tilt} = req.query
    if (!lat || !lon || !power || !azimuth || !tilt) return res.status(400).send({message: 'lat, lon, azimuth, tilt and power must given'})
    
    // TODO: Check input values
    power = parseFloat(power)
    const albedo = req.query.albedo || 0.2
    const cellCoEff = req.query.cellCoEff || -0.4
    const powerInvertor = req.query.powerInvertor || power
    const invertorEfficiency = req.query.invertorEfficiency || 1
    const timezone = req.query.timezone || 'Europe/Berlin'
    const forecast_days = req.query.forecast_days || 0
    const horizont = req.query.horizont && req.query.horizont.split(',') || null
    const additionalRequestData = req.query.hourly && req.query.hourly.split(',') || []
    const timeCycle = req.query.timecycle || 'hourly'
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
        // timezone,
        albedo,
        forecast_days,
        invertorEfficiency,
        powerInvertor,
        cellCoEff
    }

    const baseParams = {
        latitude: lat,
        longitude: lon,
        [timeCycle]: megreArraysUnique(requestData,additionalRequestData).join(','),
        // hourly: megreArraysUnique(requestData,additionalRequestData).join(','),
        // minutely_15: megreArraysUnique(requestData,additionalRequestData).join(','),
        timezone,
    }
    


    if (req.path == '/forecast') {

        params = {...baseParams,forecast_days}
        meta = {...baseMeta, forecast_days}
        weatherRequestUrl = 'https://api.open-meteo.com/v1/dwd-icon'
    
        
        // https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&hourly=temperature_2m,shortwave_radiation,diffuse_radiation,direct_normal_irradiance&forecast_days=1
        
        
        
    } else if (req.path == '/archive') {
        const yesterday = new Date(new Date() - (1 * 24 * 60 * 60 * 1000))
        const lastWeek = new Date(yesterday - (7 * 24 * 60 *60 * 1000))
        
        yesterdayString = `${yesterday.getFullYear()}-${("0" + (yesterday.getMonth()+1)).slice(-2)}-${("0" + yesterday.getDate()).slice(-2)}`
        lastWeekString = `${lastWeek.getFullYear()}-${("0" + (lastWeek.getMonth()+1)).slice(-2)}-${("0" + lastWeek.getDate()).slice(-2)}`
        
        // TODO: Check input values
        
        const start_date = req.query.start_date || lastWeekString 
        const end_date = req.query.end_date || yesterdayString 
        
        meta = {...baseMeta,start_date, end_date}
        params = {...baseParams, start_date, end_date}
        
        weatherRequestUrl = 'https://archive-api.open-meteo.com/v1/archive'

        // https://archive-api.open-meteo.com/v1/archive?latitude=52.52&longitude=13.41&start_date=2023-05-25&end_date=2023-06-10&hourly=temperature_2m,shortwave_radiation,diffuse_radiation,direct_normal_irradiance&timezone=Europe%2FBerlin&min=2023-05-27&max=2023-06-10
        
        
    } else {
        res.status(400).send({error:true})
    }

    try {
        const response = await axios.get(weatherRequestUrl,{params})
        const values = calculateForcast({lat,lon, weatherData: response.data, azimuth, tilt, cellCoEff, power, albedo, powerInvertor, invertorEfficiency, DEBUG, additionalRequestData})
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
