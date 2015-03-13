var request = require("request");
var cityData = require("./city.json");
var _ = require("lodash");
var async = require("async");
var jf = require('jsonfile');
var moment = require('moment');

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
        } catch (e) {
            callback(error);
        }

        console.log(data.MonitoringPointName);
        captured.push(data);

        if (_.isEmpty(c.MC)) {
            _.each(data.CityMonitorPoint, function (v) {
                q.push({cityId: c.cityId, MC: v.MC});
            });
        }

        callback();
    });
}, 50);

q.drain = function () {
    console.log('all items have been processed');
    jf.writeFileSync("captured" + moment().format("YYYY_MM_DD_HH_mm_ss") + ".json", captured);
};

//request.debug = true;
_.forEach(city, function (c) {
    console.log(c.CityName);
    q.push({cityId: c.CityID});
});