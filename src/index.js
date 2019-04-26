const fs = require('fs')
const path = require('path')
const { URLSearchParams } = require('url')
const puppeteer = require('puppeteer')
const argv = require('yargs').argv

const { HOST, UA } = require('./config')
const { getCookies, mkdirsSync, getXhrUrl } = require('./util/util')
const cookies = getCookies()
const CACHE_DATA = new Map()
const TAGS = {}

let rootId
let cstk = (cookies.find(item => item.name === 'YNOTE_CSTK') || {}).value // c[1] 预设cookie从cookie中获取cstk
let xhrUrl = getXhrUrl(cstk)

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

    const download = fileEntry => {
        const { id, name, version, transactionTime } = fileEntry

        // console.log('download', id)
        // TODO: 方式二 xhr获取文件内容fs写入本地 方便还原目录
        return page.evaluate(
            (xhrUrl, id, cstk) => {
                const formData = `fileId=${id}&version=-1&read=true&cstk=${cstk}`
                const oReq = new XMLHttpRequest()

                oReq.open('post', xhrUrl, true)
                oReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
                oReq.send(formData)
            },
            xhrUrl,
            id,
            cstk
        )

        const url = `https://note.youdao.com/yws/api/personal/sync?method=download&fileId=${id}&version=${version}&cstk=${cstk}&keyfrom=web`
        // console.log(url)
        // 方式一直接下载
        return page.goto(url)
    }

    const downloadDir = fileEntry => {
        const { id, name, version, transactionTime } = fileEntry
        const url = `https://note.youdao.com/yws/api/personal/file/${id}?all=true&f=true&len=${100}&sort=2&isReverse=false&method=listPageByParentId&keyfrom=web&cstk=${cstk}`

        // console.log(url)
        return page.evaluate(x => {
            var oReq = new XMLHttpRequest()
            oReq.open('get', x, true)
            oReq.send()
        }, url)
    }

    const getPathById = (id, pathArray) => {
        if (id === rootId) {
            const filePath = ['.', 'download', rootId, '我的文件夹'].concat(pathArray).join('/')

            return filePath
        }

        const fileEntry = CACHE_DATA.get(id)

        pathArray.unshift(fileEntry.name)
        return getPathById(fileEntry.parentId, pathArray)
    }

    const getBlogInfo = id => {
        const fileEntry = CACHE_DATA.get(id)
        const tagsArr = fileEntry.tags ? fileEntry.tags.split(',') : []
        const tags = tagsArr.map(item => ` - ${TAGS[item]}`).join('\n')
        return new Buffer(`
---
title: ${fileEntry.name.replace('.md', '')}
date: ${new Date(fileEntry.createTimeForSort * 1000)}
tags:
${tags}
---

`)
    }

    page.on('response', async resp => {
        const url = resp.url()

        // 获取标签
        if (url.indexOf('https://note.youdao.com/yws/mapi/tag?keyfrom=web&cstk=') !== -1) {
            resp.json()
                .then(async data => {
                    if (Array.isArray(data.tags)) {
                        data.tags.forEach(item => {
                            TAGS[item.id] = item.name
                        })
                    }
                })
                .catch(error => {
                    // console.log(error)
                })
        }

        if (url === xhrUrl) {
            const postData = resp.request().postData()
            const urlData = new URLSearchParams(postData)
            const fileId = urlData.get('fileId')

            if (!CACHE_DATA.get(fileId)) {
                return false
            }
            const filePath = getPathById(fileId, [])
            mkdirsSync(path.dirname(filePath))

            console.log(postData, fileId, filePath)
            let buffer = await resp.buffer()
            // 添加文档信息 hexo next
            if (argv.blog) {
                buffer = Buffer.concat([getBlogInfo(fileId), buffer])
            }
            fs.writeFileSync(`${filePath}`, buffer)
        }

        if (url.indexOf('method=listPageByParentId') !== -1) {
            // c[3] 我的文件夹 根目录
            if (!rootId) {
                rootId = url.match(/\/file\/(.*)\?/i)[1]
            }

            // c[2] 手动登录url获取cstk
            if (!cstk) {
                cstk = url.match(/\&cstk=([^#&]*)/i)[1]
                xhrUrl = getXhrUrl(cstk)
            }

            resp.json()
                .then(async data => {
                    // 我的文件夹
                    // console.log(rootId, data)
                    if (data.count === 0) {
                        console.log('空文件夹')
                        return false
                    }
                    for (let item of data.entries) {
                        CACHE_DATA.set(item.fileEntry.id, item.fileEntry)
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
                })
                .catch(error => {
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
