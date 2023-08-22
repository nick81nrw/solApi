const oauthIssuers = () => {
    let issuers = []
    
    if (process.env.OAUTH_AKKUDOKTOR_CLIENTID && process.env.OAUTH_AKKUDOKTOR_CLIENTSECRET) {
        issuers.push({
            issuer: 'Akkudoktor Forum',
            clientId: process.env.OAUTH_AKKUDOKTOR_CLIENTID,
            clientSecret: process.env.OAUTH_AKKUDOKTOR_CLIENTSECRET,
            redirectUri: 'https://api.akkudoktor.net/account/callback',
            authEndpoint: 'https://www.akkudoktor.net/wp-json/moserver/authorize',
            tokenEndpoint: 'https://www.akkudoktor.net/wp-json/moserver/token',
            userinfoEndpoint: 'https://www.akkudoktor.net/wp-json/moserver/resource',
            scope: 'openid profile email',
            createAuthUrl(exchangeToken = '') {
                return `${this.authEndpoint}?response_type=code&client_id=${this.clientId}&redirect_uri=${this.redirectUri}&scope=${this.scope}&state=${this.issuer+':'+exchangeToken}`
            },
            createTokenrequestParams(code) {
                return {
                    grant_type: 'authorization_code',
                    code,
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    redirect_uri: this.redirectUrl
                }
            }
        })
    }

    return issuers
}


module.exports = oauthIssuers()