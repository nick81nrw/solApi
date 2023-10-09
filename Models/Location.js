
const mongoose = require('mongoose')

const pvField = mongoose.Schema({
    kilowattpeak: Number,
    azimuth: Number,
    tilt:  Number,
    albedo: Number,
    powerInverter: Number,
    inverterEfficiency: Number,
    horizont: String
})

const battery = mongoose.Schema({
    kilowatthours: Number,
    loadEfficiency: Number,
    unloadEfficiency: Number,
    minSoc: Number,
    maxmSoc: Number,
})

const locationSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    location: {
        type: {
          type: String, 
          enum: ['Point'], 
          required: true
        },
        coordinates: {
          type: [Number],
          required: true
        }
    },
    pvFields: {
        type: [pvField]
    },
    batterys: {
        type: [battery]
    },
    powerExtraCosts: Number,
    defaultAlbedo: Number,
    defaultPowerInverter: Number,
    defaultInverterEfficiency: Number,
    defaultHorizont: String,
    created: {type: Date, default: Date.now()},
})

const Location = mongoose.model('Location', locationSchema)


module.exports = {
    Location
}