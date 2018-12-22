const { COOKIE } = require('../config')

exports.getCookies = () => {
    return !COOKIE
        ? []
        : COOKIE.split('; ').map(element => {
              const cookie = element.split('=')

              return {
                  name: cookie[0],
                  value: cookie[1],
                  domain: '.note.youdao.com',
                  path: '/'
              }
          })
}
