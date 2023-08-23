const { default: axios } = require("axios")
const querystring = require('node:querystring')
const { getOrCreateOauthUser } = require("./userController")

const oauthIssuers = require('../oauthIssuers')

const oauthCallback = async (req,res) => {
    const {code, state} = req.query

    const [oauthIssuer, exchangeToken,...rest] = state.split(':')
    const issuer = oauthIssuers.find(i => i.issuer == oauthIssuer)
    if (!issuer) return res.render('pages/login', {error:'no oauth issuer found ' + oauthIssuer})

    // TODO: Validation
    const params = querystring.encode(issuer.createTokenrequestParams(code))

    const tokenResponse = await axios.post(issuer.tokenEndpoint, params)

    //TODO: Errorhandling
    
    const {token_type, access_token} = tokenResponse.data
    const requestConfig = {
        headers: {
            Authorization: `${token_type} ${access_token}`
        }
    }
    const profileResponse = await axios(issuer.userinfoEndpoint,requestConfig)
    //TODO: Errorhandling

    const {username, email} = profileResponse.data

    const user = await getOrCreateOauthUser({username, email, access_token, token_type, oauthIssuer})
    if (!user) return res.redirect('/account')

    
    req.session.user = user
    res.redirect('/account')
    

}

module.exports = {
    oauthIssuers,
    oauthCallback

}