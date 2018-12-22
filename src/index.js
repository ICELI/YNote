const fs = require('fs')
const puppeteer = require('puppeteer')
const argv = require('yargs').argv

const { HOST, UA } = require('./config')
const { getCookies } = require('./util/util')

const cookies = getCookies()

;(async () => {
    console.log('启动浏览器')
    const browser = await puppeteer.launch({
        args: ['--disable-dev-shm-usage'],
        headless: argv.headless || false,
        devtools: argv.devtools || false
    })

    console.log('打开页面')
    const page = await browser.newPage()

    // console.log('设置UA，cookie')
    await page.setCookie(...cookies)

    // 必须在emulate后
    await page.setUserAgent(UA)

    // c[1] 预设cookie从cookie中获取cstk
    let cstk = (cookies.find(item => item.name === 'YNOTE_CSTK') || {}).value
    const download = fileEntry => {
        const { id, name, version, transactionTime } = fileEntry
        const url = `https://note.youdao.com/yws/api/personal/sync?method=download&fileId=${id}&version=${version}&cstk=${cstk}&keyfrom=web`
        
        // TODO: 方式二 xhr获取文件内容fs写入本地 方便还原目录
        console.log(url)
        // 方式一直接下载
        return page.goto(url)
    }
    const downloadDir = fileEntry => {
        const { id, name, version, transactionTime } = fileEntry
        const url = `https://note.youdao.com/yws/api/personal/file/${id}?all=true&f=true&len=${100}&sort=2&isReverse=false&method=listPageByParentId&keyfrom=web&cstk=${cstk}`
        
        console.log(url)
        return page.evaluate((x) => {
            var oReq = new XMLHttpRequest();
            oReq.open("get", x, true);
            oReq.send();
        }, url);
    }

    page.on('response', resp => {
        const url = resp.url()

        if (url.indexOf('method=listPageByParentId') !== -1) {
            const rootId = url.match(/\/file\/(.*)\?/i)[1]
            
            // c[2] 手动登录url获取cstk
            if (!cstk) {
                cstk = url.match(/\&cstk=([^#&]*)/i)[1]
            }
            resp.json().then(async data => {
                // 我的文件夹
                console.log(rootId, data)
                if (data.count === 0) {
                    console.log('空文件夹')
                    return false
                }
                for (let item of data.entries) {
                    if (item.fileMeta.storeAsWholeFile) {
                        // 只下载markdown文件
                        if (item.fileMeta.title.endsWith('.md')) {
                            await download(item.fileEntry).catch(e => {
                                //console.log(e)
                            })
                        }
                    } else {
                        await downloadDir(item.fileEntry)
                    }
                }

            }).catch(error => {
                // console.log(error)
            })
        }
    })

    page.on('load', () => {})

    await page.goto(HOST, { waitUntil: 'networkidle0' }).catch(error => {
        // console.log(error)
    })
    await page.click('#my-documents').catch(error => {
        // console.log(error)
    })
    // console.log(responses.length, responses.join(','))
    // browser.close()
})()
