const axios = require('axios')

const {getCache, setCache} = require('../caching')

const getPrices = async ({start, end}) => {

    if (typeof start == 'string' && start.match(/^\d{4}-([0]\d|1[0-2])-([0-2]\d|3[01])$/)) start = (new Date(start).setHours(0,0,0,0))
    if (typeof end == 'string' && end.match(/^\d{4}-([0]\d|1[0-2])-([0-2]\d|3[01])$/)) end = (new Date(end).setHours(24,0,0,0))
    
    if (typeof start == 'string' && start.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)((-(\d{2}):(\d{2})|Z)?)$/)) start = (new Date(start))
    if (typeof end == 'string' && end.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)((-(\d{2}):(\d{2})|Z)?)$/)) end = (new Date(end))

    const params = {start, end}

    const response = await axios.get('https://api.awattar.de/v1/marketdata',{params})

    const result = response.data.data.map(val => {
        val.start = new Date(val.start_timestamp).toISOString()
        val.end = new Date(val.end_timestamp).toISOString()
        val.marketpriceEurocentPerKWh = parseFloat((val.marketprice / 10).toFixed(2))
        return val
    })

    return result
}

const checkDateFormat = string => {
    return string.match(/^\d{4}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01])$/)
}

const routeGetPrices = async (req,res) => {
    
    // TODO: Check input values
    if(req.query.start && !checkDateFormat(req.query.start)) return res.status(400).send({error: `parameter [start] mus be in format [YYYY-MM-DD]. Your value: ${req.query.start}`})
    if(req.query.end && !checkDateFormat(req.query.end)) return res.status(400).send({error: `parameter [end] mus be in format [YYYY-MM-DD]. Your value: ${req.query.end}`})
   
    const start = req.query.start || (new Date().setHours(0,0,0,0))
    const end = req.query.end || (new Date().setHours(24,0,0,0))

    if (end < start) return res.status(400).send({error: `start must be before end. start: ${start} | end: ${end}`})

    const cached = await getCache({start,end}, {prefix:'price-'})
    if (cached) return res.send(cached)

    const values = await getPrices({start, end})

    const meta = {
        start_timestamp: start,
        end_timestamp: end,
        start: new Date(start),
        end: new Date(end)
        
        }
    await setCache({start,end}, {meta, values}, {prefix:'price-'})

    return res.send({meta, values})

}

module.exports = {
    getPrices,
    routeGetPrices
}
