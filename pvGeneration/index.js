const axios = require('axios')
const sunCalc = require('suncalc')
const moment = require('moment-timezone')

const {getCache, setCache} = require('../caching')

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

const getStatisticValues = arr => {
    if (!(Array.isArray(arr) && arr.length > 0)) return null
    const error = arr.reduce((prev,curr)=>typeof curr !== 'number',false)
    if (error) return null
    const numbers = arr.map(v => parseFloat(v))
    const sum = numbers.reduce((prev,curr) => prev + curr ,0)
    const max = Math.max(...numbers)
    const min = Math.min(...numbers)
    const avg = sum / numbers.length
    const sort = [...numbers].sort()
    const median = sort.length % 2 == 1 ? sort[Math.floor(sort.length/2)] : sort.slice(sort.length/2-1,sort.length/2+1).reduce((prev,curr) => prev+curr)/2
    return {sum,max,min,avg,median}
}

const covertArray = (dataTimeline, searchKey) => {
    if (Object.keys(dataTimeline).find(e => e.startsWith(searchKey))){

        const keys = Object.keys(dataTimeline).filter(e => e.startsWith(searchKey))
        const values = keys
                .map(k => dataTimeline[k])
                .reduce((prev,curr) => {
                    curr.map((e,i) => {
                        if (!prev[i]) return prev[i] = [e]
                        prev[i].push(e)
                    })
                    return prev
                },[])
                .map(val => getStatisticValues(val) )
        return values
    } else { return 0}
}

const calcRadiadion = ({dni,diffuse,shortwave,efficiency, albedo, temperature, cellCoEff, power, powerInverter, inverterEfficiency, tilt}) => {

    const shortwaveEfficiency = (0.5 - 0.5 * Math.cos(tilt / 180 * Math.PI))
    const diffuseEfficiency   = (0.5 + 0.5 * Math.cos(tilt / 180 * Math.PI))

    const totalRadiationOnCell = dni !== null && diffuse !== null && shortwave !== null ? dni * efficiency + diffuse * diffuseEfficiency + shortwave * shortwaveEfficiency * albedo : 0
    const cellTemperature = calcCellTemperature(temperature, totalRadiationOnCell) //  Temperature??
    if (totalRadiationOnCell == 0) return [0,0,0,cellTemperature]
    const dcPower = totalRadiationOnCell / 1000 * power * (1 + (cellTemperature - 25) * (cellCoEff/100))
    const acPower = dcPower > powerInverter ? powerInverter * inverterEfficiency : dcPower * inverterEfficiency
    return [acPower, dcPower, totalRadiationOnCell, cellTemperature]
}


const calculateForcast = ({weatherData, weatherModelsResponse, power, lat, lon, DEBUG, additionalRequestData, summary, timezone,...args}) => {

    power = Array.isArray(power) ? power : [power]
    
    const calculations = power.map((powerVal,i) => {
        const azimuth = Array.isArray(args.azimuth) ? args.azimuth[i] : args.azimuth
        const tilt = Array.isArray(args.tilt) ? args.tilt[i] : args.tilt
        const albedo = Array.isArray(args.albedo) ? args.albedo[i] : args.albedo
        const cellCoEff = Array.isArray(args.cellCoEff) ? args.cellCoEff[i] : args.cellCoEff
        const powerInverter = Array.isArray(args.powerInverter) ? args.powerInverter[i] : args.powerInverter
        const inverterEfficiency = Array.isArray(args.inverterEfficiency) ? args.inverterEfficiency[i] : args.inverterEfficiency
        const horizont = Array.isArray(args.horizont) && Array.isArray(args.horizont[0])  ? args.horizont[i] : args.horizont

        const pvVectors = [
            Math.sin(azimuth/180*Math.PI) * Math.cos((90-tilt) / 180 * Math.PI),
            Math.cos(azimuth/180*Math.PI) * Math.cos((90-tilt) / 180 * Math.PI),
            Math.sin((90-tilt) / 180 * Math.PI),
        ]
    
        // TODO: Could be remove in future (minutely_15)
        const dataTimeline = weatherData && weatherData.minutely_15 ? weatherData.minutely_15 :  weatherData.hourly
    
        if (!dataTimeline) return []
        
        // const statsTemperature = covertArray(dataTimeline, 'temperature_2m_')
        const statsDni = weatherModelsResponse ? covertArray(weatherModelsResponse.hourly, 'direct_normal_irradiance') : null
        const statsDiffuse = weatherModelsResponse ? covertArray(weatherModelsResponse.hourly, 'diffuse_radiation') : null
        const statsShortwave = weatherModelsResponse ? covertArray(weatherModelsResponse.hourly, 'shortwave_radiation') : null
        
        const weatherModelTimeLine = weatherModelsResponse && weatherModelsResponse.hourly &&  weatherModelsResponse.hourly.time ? weatherModelsResponse.hourly.time : null
        
        const values = dataTimeline.time.map((time, idx) => {
            const dniRad = dataTimeline.direct_normal_irradiance[idx]
            const diffuseRad = dataTimeline.diffuse_radiation[idx]
            const shortwaveRad = dataTimeline.shortwave_radiation[idx]
            const temperature = dataTimeline.temperature_2m[idx]


            const statsIdx = weatherModelTimeLine && Array.isArray(weatherModelTimeLine) ? weatherModelTimeLine.indexOf(time) : null
            
            //min/max/avg calc if "ensemble" is used
            const maxDniRad = statsIdx !== null && statsDni !== null && statsDni[statsIdx] && statsDni[statsIdx].max ? statsDni[statsIdx].max : null
            const maxDiffuseRad = statsIdx !== null && statsDiffuse !== null && statsDiffuse[statsIdx] && statsDiffuse[statsIdx].max ? statsDiffuse[statsIdx].max : null
            const maxShortwaveRad = statsIdx !== null && statsShortwave !== null && statsShortwave[statsIdx] && statsShortwave[statsIdx].max ? statsShortwave[statsIdx].max : null
            const minDniRad = statsIdx !== null && statsDni !== null && statsDni[statsIdx] && statsDni[statsIdx].min ? statsDni[statsIdx].min : null
            const minDiffuseRad = statsIdx !== null && statsDiffuse !== null && statsDiffuse[statsIdx] && statsDiffuse[statsIdx].min ? statsDiffuse[statsIdx].min : null
            const minShortwaveRad = statsIdx !== null && statsShortwave !== null && statsShortwave[statsIdx] && statsShortwave[statsIdx].min ? statsShortwave[statsIdx].min : null
            //TODO: min/max Temperature to calc losses ?
            // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<


            const t = moment(time).tz(timezone)
            const localTime = t.toISOString(true) //.slice(0,-6)
    
            // TODO: Could be remove in future (minutely_15)
            const sunPosTime = weatherData.minutely_15 ? new Date(new Date(t).setMinutes(7)) : new Date(new Date(t).setMinutes(30)) // mid of time slot
            const sunPos = sunCalc.getPosition(sunPosTime, lat, lon)
            const sunAzimuth = sunPos.azimuth * 180 / Math.PI
            const sunTilt = sunPos.altitude * 180 / Math.PI
            const sunVectors = [
                Math.sin(sunAzimuth/180*Math.PI) * Math.cos(sunTilt / 180 * Math.PI),
                Math.cos(sunAzimuth/180*Math.PI) * Math.cos(sunTilt / 180 * Math.PI),
                Math.sin(sunTilt /  180*Math.PI),
            ]
    
            let efficiency = 0
    
            sunVectors.forEach((v,i) => {
                efficiency += v * pvVectors[i]
                
            })
            efficiency = efficiency <= 0 ? 0 : efficiency
    
            // Shading
            if (horizont && efficiency > 0) {
                const horizontValues = horizont.find(h => sunAzimuth >= h.azimuthFrom && sunAzimuth < h.azimuthTo)
                if (!horizontValues) return
                if (horizontValues.altitude > sunTilt) {
                    efficiency = efficiency * horizontValues.transparency || 0
                }
            }
    
            let [acPower, dcPower, totalRadiationOnCell, cellTemperature] = calcRadiadion({dni:dniRad, diffuse: diffuseRad, shortwave: shortwaveRad, 
                                                                                efficiency, albedo, cellCoEff, power: powerVal, inverterEfficiency, powerInverter, temperature, tilt})
            let [maxPower, dcMaxPower] = maxDniRad == null ? [0,0] : calcRadiadion({dni:maxDniRad, diffuse: maxDiffuseRad, shortwave: maxShortwaveRad, 
                                                                                efficiency, albedo, cellCoEff, power: powerVal, inverterEfficiency, powerInverter, temperature, tilt})
            let [minPower, dcMinPower] = minDniRad == null ? [0,0] : calcRadiadion({dni:minDniRad, diffuse: minDiffuseRad, shortwave: minShortwaveRad, 
                                                                                efficiency, albedo, cellCoEff, power: powerVal, inverterEfficiency, powerInverter, temperature, tilt}) 
            
            // TODO: Could be remove in future (minutely_15)
            if (weatherData.minutely_15) {
                acPower = acPower / 4
                dcPower = dcPower / 4
                maxPower = maxPower / 4
                dcMaxPower = dcMaxPower / 4
                minPower = minPower / 4
                dcMinPower = dcMinPower / 4
            }
            

            const calcResult = {
                datetime: localTime,
                dcPower,
                power: acPower,
                sunTilt,
                sunAzimuth,
                temperature,
            }
            if (weatherModelsResponse) calcResult.maxPower = maxPower
            if (weatherModelsResponse) calcResult.minPower = minPower

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
            if (DEBUG && dcMaxPower !== null) calcResult.dcMaxPower = dcMaxPower
            if (DEBUG && dcMinPower !== null) calcResult.dcMinPower = dcMinPower
            if (DEBUG && horizont) calcResult.horizont = horizontVal
    
            return calcResult


        })
        return values


    })

    // TODO: Could be remove in future (minutely_15)
    if (weatherData.minutely_15) {

        const summaryObject = calculations.map(values => values.reduce((prev, curr,i) => {
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

        },{}))
        
        const summary = summaryObject.length == 1 ? Object.values(summaryObject[0]) : summaryObject.map(s => Object.values(s))
        
        return {values:calculations.length == 1 ? calculations[0]:calculations, summary}
    }

    return {values:calculations.length == 1 ? calculations[0]:calculations}
}

const calcCellTemperature = (temperature, totalRadiotionOnCell) => {
    return temperature + 0.0342*totalRadiotionOnCell
}


const routePvGeneration = async (req,res) => {
    
    const lat = validate.lat(req.query.lat)
    const lon = validate.lon(req.query.lon)
    const {power, azimuth, tilt, roofsLen} = validate.powerAzimuthTilt(req.query.power, req.query.azimuth, req.query.tilt)
    
    const wrongParameters = [{lat},{lon},{power},{azimuth},{tilt}].map(p => Object.values(p)[0] ? false : ({[Object.keys(p)[0]]:req.query[Object.keys(p)[0]]})).filter(p => p !== false)
    if (!lat || !lon || !power || !azimuth  || !tilt) return res.status(400).send({message: 'lat, lon, azimuth, tilt and power must given and valid and azimuth, tilt and power must be the same type (number or array) and the same length if type is array. ',wrongParameters})
    
    const albedo = validate.validateFn(roofsLen, validate.albedo, req.query.albedo) || 0.2
    const cellCoEff = validate.validateFn(roofsLen, validate.cellCoEff, req.query.cellCoEff) || -0.4
    const powerInverter = validate.validateFn(roofsLen, validate.powerInverter, req.query.powerInverter) || power
    const inverterEfficiency = validate.validateFn(roofsLen, validate.inverterEfficiency, req.query.inverterEfficiency) || 1
    const timezone = req.query.timezone || 'Europe/Berlin'
    const past_days = validate.past_days(req.query.past_days) || 0
    const horizont = validate.validateFn(roofsLen, validate.parseHorizont, req.query.horizont) || null
    const additionalRequestData = req.query.hourly && req.query.hourly.split(',') || []
    const timeCycle = validate.timeCycle(req.query.timecycle) || 'hourly'
    const summary = validate.summary(req.query.summary) || 'hourly'
    const start_date = past_days > 0 && validate.start_date(req.query.start_date) || false
    const end_date = past_days > 0 &&  validate.end_date(req.query.end_date) || false
    const range = !!(req.query.range)
    const DEBUG = !!((req.query.debug ||req.query.DEBUG)  || false)

    const cacheKey = {path: req.path,lat,lon,power, azimuth, tilt,albedo,cellCoEff,powerInverter,inverterEfficiency,
        timezone,past_days,horizont,additionalRequestData,timeCycle,summary,start_date,end_date,range,DEBUG}

    const cached = await getCache(cacheKey, {prefix:'pvcalculation-'})
    
    if (cached) {
        return res.send(cached)
    }

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
        inverterEfficiency,
        powerInverter,
        cellCoEff,
        range
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
        console.log({weatherRequestUrl,params})
        
        const weatherModelUrl = 'https://ensemble-api.open-meteo.com/v1/ensemble'
        const weatherModelsParams = {...baseParams, models: 'icon_d2', forecast_days:2, past_days}
        if (range) console.log({weatherModelUrl,weatherModelsParams})
        
        const weatherModelsCache = range ? await getCache({weatherModelUrl,weatherModelsParams},{prefix:'weathermodel-'}) : null
        const weatherModelsResponse = weatherModelsCache && range ? JSON.parse(weatherModelsCache) : range && await axios.get(weatherModelUrl,{params: weatherModelsParams}).then(r => r.data)
        if (weatherModelsCache == null && weatherModelsResponse) await setCache({weatherModelUrl,weatherModelsParams}, weatherModelsResponse, {prefix:'weathermodel-'}) 

        const weatherCached = await getCache({weatherRequestUrl,params},{prefix:'weather-'})
        const response = weatherCached ? JSON.parse(weatherCached) : await axios.get(weatherRequestUrl,{params}).then(r => r.data)
        
        await setCache({weatherRequestUrl,params}, response, {prefix:'weather-'})

        const values = calculateForcast({lat,lon, weatherData: response, weatherModelsResponse, azimuth, tilt, cellCoEff, power, albedo, powerInverter, inverterEfficiency, DEBUG, additionalRequestData, horizont, summary, timezone})
        
        await setCache(cacheKey, {meta, ...values}, {prefix:'pvcalculation-'})
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
    megreArraysUnique,
    getStatisticValues
}
