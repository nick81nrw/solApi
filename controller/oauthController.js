const { default: axios } = require("axios")
const querystring = require('node:querystring')
const { getOrCreateOauthUser } = require("./userController")

const oauthIssuers = require('../oauthIssuers')

// const clientId = 'neMdQxiSLkQofexYYWkUiGJnJSgCKQHr'
// const clientSecret = 'ukoVgMUuVEFlZeCayiAVlbNTRiOotodh'

// const redirectUrl = 'https://api.akkudoktor.net/account/callback'

// const authEndpoint = 'https://www.akkudoktor.net/wp-json/moserver/authorize'
// const tokenEndpoint = 'https://www.akkudoktor.net/wp-json/moserver/token'
// const userinfoEndpoint = 'https://www.akkudoktor.net/wp-json/moserver/resource'
// const scope = 'openid profile email'

// const authUrl = 'https://www.akkudoktor.net/wp-json/moserver/authorize?response_type=code&client_id=neMdQxiSLkQofexYYWkUiGJnJSgCKQHr&redirect_uri=https://api.akkudoktor.net/account/callback&scope=openid%20profile%20email&state=abcde'
// const response = 'https://api.akkudoktor.net/account/callback?code=c72d65097ab917ec5f8adf565fcf583f29d3e068&state=abcde'

// const tokenRequestPost = tokenEndpoint + `grant_type=authorization_code&code=c72d65097ab917ec5f8adf565fcf583f29d3e068&client_id=<client_id>&${clientId}client_secret=${clientSecret}&redirect_uri=${redirectUrl}`

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