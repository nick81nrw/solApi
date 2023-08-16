

const toFloat = num => {
    try {
        return parseFloat(num)
    } catch(e) {
        return false
    }
}
const toInt = num => {
    try {
        return parseInt(num)
    } catch(e) {
        return false
    }
}

const isIsoDate = (str) => {
    if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(str)) return true;
    return false
  }

const checkArray = (arr,func) => {
    const res = arr.map(elem => func(elem))
    if (res.find(r => r == false)) return false
    return res
}

module.exports = {
    summary: str => {
        const allowed = ['hourly', 'minutely_15', 'daily']
        if (allowed.includes(str)) return str
        return false
    },
    validateFn: function(len, fn, val) {
        if (!val) return false
        console.log({val,len})
        if (Array.isArray(val)) {
            if (len == val.length) return val.map(fn)
        } else {
            return fn(val)
        }
    },
    powerAzimuthTilt: function(power, azimuth, tilt)  {


        if (! ( (Array.isArray(power) && Array.isArray(azimuth) && Array.isArray(tilt)) || (!Array.isArray(power) && !Array.isArray(azimuth) && !Array.isArray(tilt)) ) ) {
            return {
                power: false, azimuth: false, tilt: false
            }
        }
        
        if (Array.isArray(power) && !(power.length == azimuth.length && power.length == tilt.length) ) {
            
            return {
                power: false, azimuth: false, tilt: false
            }
        }
        
        return {
            power: Array.isArray(power) ? checkArray(power, this.power) : this.power(power),
            azimuth: Array.isArray(azimuth) ? checkArray(azimuth, this.azimuth) : this.azimuth(azimuth),
            tilt: Array.isArray(tilt) ? checkArray(tilt, this.tilt) : this.tilt(tilt),
            roofsLen: Array.isArray(power) ? power.length : false
        }
        
    },
    lat: value => {
        if (toFloat(value) && value >= -90 && value <= 90) return toFloat(value)
        return false
    },
    lon: value => {
        if (toFloat(value) && value >= 0 && value <= 180) return toFloat(value)
        return false
    },
    power: value => {
        if (toInt(value) && value >= 0) return toInt(value)
        return false
    },
    azimuth: value => {
        if (toFloat(value)  && value >=-180 && value <= 180) return toFloat(value)
        return false
    },
    tilt: value => {
        if (toFloat(value) && value >= 0 && value <= 90) return toFloat(value)
        return false
    },
    albedo: value => {
        if (toFloat(value) && value >= 0 && value <= 1) return toFloat(value)
        return false
    },
    cellCoEff: value => {
        if (toFloat(value) && value >= -1 && value <= 0) return toFloat(value)
        return false
    },
    powerInvertor: value => {
        if (toInt(value) && value >= 0 ) return toInt(value)
        return false
    },
    invertorEfficiency: value => {
        if (toInt(value) && value >= 0 &&  value <= 1) return toInt(value)
        return false
    },
    past_days: value => {
        if (toInt(value) && value >= 0 &&  value <= 92) return toInt(value)
        return false
    },
    timeCycle: value => {
        const allowed = ['hourly', 'minutely_15']
        if (typeof value == 'string' && allowed.includes(value)) return value
        return false
    },
    start_date: value => {
        if (value && isIsoDate(value)) return value
        return false
    },
    end_date: value => {
        if (value && isIsoDate(value)) return value
        return false
    },
    parseHorizont: (horizontString => {
        //TODO: validate input
        if (!horizontString) return false
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
    
}