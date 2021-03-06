var dns = require('dns'),
    fs = require('fs'),
    url = require('url'),
    magick = require('imagemagick-native-2'),
    request = require('request'),
    cheerio = require('cheerio'),
    firefox = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.9; rv:28.0) '+
              'Gecko/20100101 Firefox/28.0'

function getMany(domains) {
    if (domains.length) {
        var domain = domains.pop().toLowerCase()
        get(domain, function () { getMany(domains) })
    }
}

function get(domain, done) {
    console.log('=>', domain)
    if (resemblesDomainName(domain)) {
        dns.resolve4(domain, function (err, addr) {
            if (err) {
                console.error('%s: cannot resolve (%s)', R(domain), err)
                setImmediate(done)
                return
            }
            get2(domain, done, function () { get1(domain, done) })
        })
    }
    else {
        console.error('%s: bad domain name', R(domain))
        setImmediate(done)
        return
    }
}

function get1(/* optional */ url, domain, done) {
    if (typeof domain == 'function') {
        done = domain
        domain = url
        url = 'http://' + domain + '/favicon.ico'
    }
    console.log('[1] =>', url)
    request(options(url), function (err, res, buf) {
        var err2, contentType
        if (err) {
            console.error('%s: cannot download\n(%s)', R(url), res.request.href)
            setImmediate(done)
            return
        }
        res.statusCode == 200 || (err2 = res.statusCode)
        contentType = res.headers['content-type'] || 'n/a'
        contentType.substr(0, 6) == 'image/' || (err2 = err2 || contentType)
        if (err2) {
            console.error('%s: problem downloading (%s)', R(url), err2)
            setImmediate(done)
            return
        }
        save(buf, domain, done)
    })
}

function get2(domain, done, fail) {
    var url = 'http://' + domain
    console.log('[2] =>', url)
    request(options(url, 'utf8'), function (err, res, html) {
        var err2, contentType
        if (err) {
            console.error('%s: cannot download\n(%s)', R(url), res.request.href)
            setImmediate(fail)
            return
        }
        contentType = res.headers['content-type'] || 'n/a'
        contentType.substr(0, 5) == 'text/' || (err2 = contentType)
        if (err2) {
            console.error('%s: problem downloading (%s)', R(url), err2)
            setImmediate(fail)
            return
        }
        parse(html, res.request.href, domain, done, fail)
    })
}

function parse(html, baseUrl, domain, done, fail) {
    var $, link
    try { $ = cheerio.load(html) }
    catch (err) {
        console.error('%s: cannot parse\n(%s)', R(domain), baseUrl)
        fail()
        return
    }
    link = $('link[rel=icon]').attr('href') ||
           $('link[rel="shortcut icon"]').attr('href')
    if (link) {
        link = url.resolve(baseUrl, link)
        get1(link, domain, function (saved) {
            if (saved) done()
            else fail()
        })
    }
    else fail()
}

function save(buf, domain, done) {
    var res
    try {
        res = magick.convert({
            srcFormat: 'ICO',
            srcData: buf,
            format: 'PNG',
            height: 16,
            width: 16
        })
    }
    catch (err) {
        console.error('%s: cannot convert', R(domain))
        setImmediate(done)
        return
    }
    fs.writeFile(domain + '.png', res, function (err) {
        if (err) console.error('%s: cannot save (%s)', R(domain), err)
        setImmediate(function () { done(err === null) })
    })
}

function resemblesDomainName(domain) {
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)
}

function R(str) { return '\u001b[91m' + str + '\u001b[0m' }

function options(url, encoding) {
    return {
        url: url,
        headers: {'user-agent': firefox},
        jar: request.jar(),
        timeout: 20000,
        encoding: encoding || null
    }
}

module.exports.getMany = getMany
