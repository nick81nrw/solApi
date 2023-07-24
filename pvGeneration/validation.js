

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

module.exports = {
    summary: str => {
        const allowed = ['hourly', 'minutely_15', 'daily']
        if (allowed.includes(str)) return str
        return false
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
}