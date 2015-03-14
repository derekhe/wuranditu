var request = require("request");
var cityData = require("./city.json");
var _ = require("lodash");
var async = require("async");
var moment = require('moment');
var archiver = require('archiver');
var fs = require('fs');
var nodemailer = require('nodemailer');

var city = _.filter(cityData, function (c) {
    return c.IsHasAQI === 1;
});

var captured = [];
function getUrl(cityid, mid, indexCount) {
    mid = mid || 0;
    return {
        uri: "http://mobile.ipe.org.cn/app/app.asmx/Air_Index_Detail_1_1_a",
        method: 'GET',
        qs: {
            Lat: 0,
            IndexNames: "aqi,pm2_5,pm10,o3,so2,no2,co",
            IndexCount: indexCount || 24,
            IndexName: 'aqi',
            Cityid: cityid,
            miyao: '24646572424578787574454',
            mid: mid,
            Lng: 0,
            Uid: 0
        }
    };
}

var q = async.queue(function (c, callback) {
    var url = getUrl(c.cityId, c.MC);
    request(url, function (error, response, body) {
        if (response === undefined) {
            callback(error);
            return;
        }

        if (response.statusCode != 200) {
            callback(error);
            return;
        }

        try {
            var data = JSON.parse(body);

            console.log(data.MonitoringPointName);
            captured.push(data);

            if (_.isEmpty(c.MC)) {
                _.each(data.CityMonitorPoint, function (v) {
                    q.push({cityId: c.cityId, MC: v.MC});
                });
            }

            callback();
        } catch (e) {
            callback(error);
        }
    });
}, 20);

_.forEach(city, function (c) {
    console.log(c.CityName);
    q.push({cityId: c.CityID});
});

function saveToZipFile(json, path, filenameBase) {
    console.log("Saving to file");
    var archive = archiver('zip');
    var output = fs.createWriteStream(path);

    archive.pipe(output);
    archive.append(JSON.stringify(json, null, 4), {name: filenameBase + ".json"});
    archive.finalize();
}

function email(filenameBase, filePath) {
    var cfg;
    try {
        cfg = require("./email.json");
    }
    catch (ex) {
        return;
    }

    console.log("Sending email");
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: cfg.user,
            pass: cfg.pass
        }
    });

    var mailOptions = {
        from: 'no-reply@gmail.com',
        to: cfg.to,
        subject: "[AQI]" + filenameBase,
        attachments: {
            filename: filenameBase + ".zip",
            path: filePath
        }
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log("Error", error);
        } else {
            console.log('Message sent: ' + info.response);
        }
    });
}

q.drain = function () {
    console.log('all items have been processed');
    var filenameBase = moment().format("YYYY_MM_DD_hh_mm_ss_ZZ");
    var zipFilePath = "data/" + filenameBase + ".zip";
    saveToZipFile(captured, zipFilePath, filenameBase);
    email(filenameBase, zipFilePath);
};
