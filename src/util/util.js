const fs = require('fs')
const path = require('path')
const o777 = parseInt('0777', 8)
const { COOKIE } = require('../config')

const getCookies = () => {
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

const mkdirsSync = (p, opts, made) => {
    if (!opts || typeof opts !== 'object') {
        opts = { mode: opts }
    }

    let mode = opts.mode
    const xfs = opts.fs || fs

    if (process.platform === 'win32' && invalidWin32Path(p)) {
        const errInval = new Error(p + ' contains invalid WIN32 path characters.')
        errInval.code = 'EINVAL'
        throw errInval
    }

    if (mode === undefined) {
        mode = o777 & ~process.umask()
    }
    if (!made) made = null

    p = path.resolve(p)

    try {
        xfs.mkdirSync(p, mode)
        made = made || p
    } catch (err0) {
        if (err0.code === 'ENOENT') {
            if (path.dirname(p) === p) throw err0
            made = mkdirsSync(path.dirname(p), opts, made)
            mkdirsSync(p, opts, made)
        } else {
            // In the case of any other error, just see if there's a dir there
            // already. If so, then hooray!  If not, then something is borked.
            let stat
            try {
                stat = xfs.statSync(p)
            } catch (err1) {
                throw err0
            }
            if (!stat.isDirectory()) throw err0
        }
    }
    return made
}

const getXhrUrl = cstk => `https://note.youdao.com/yws/api/personal/sync?method=download&keyfrom=web&cstk=${cstk}`

module.exports = {
    getCookies,
    mkdirsSync,
    getXhrUrl
}
