function Api(){

    this.token = "token";

    this.url = "http://t.depo.fm/api/1.0/";
    this.parseUrl = 'http://t.depo.fm/api/1.0/models/searchModel?query={0}&token=' + this.token;

    this.regexes = {
        carYear: new RegExp('(?:(\\d{4}))', 'ig')
    };

    this.phoneFormat = [1, 3, 3, 4];

    this.manufacturers = {};
    this.models = {};
    this.cities = {};
}

Api.prototype.initialize = function(callback){

    var ths = this;

    ths._sendRequest("manufacturers", null, function(manufs){
        ths.manufacturers = manufs;

        ths._sendRequest("models", null, function(models){
            ths.models = models;

            ths._sendRequest("cities", null, function(cities){
                ths.cities = cities;

                // transform vocabularies for easier utilization
                ths.manufacturers = ths.manufacturers.result;
                ths.models = ths.models.result;
                ths.cities = ths.cities.result;

                if (callback) {
                    callback();
                }

            });

        });

    });

};

Api.prototype._sendRequest = function(action, data, callback, onError){

    $.ajax({
        global: false,
        async: true,
        url: this.url + action + "?token=" + this.token,
        type: (data == null ? "GET" : "POST"),
        data: data,
        dataType: "json"
    }).success(function(a,b,c){
        callback(a);
    }).error(function(a,b){
        if (onError) onError(a);
        callback(a);
    });

};

Api.prototype._lookupCity = function(cityName){

    var cityId = "";

    for(var key in this.cities){
        if (this.cities[key].name.toLowerCase().replace(/\s/ig, "") == cityName.toLowerCase().replace(/\s/ig, "")){
            cityId = key;
            break;
        }
    }

    return cityId;

};
Api.prototype._parseCarString = function(carString, callback){

    var result = {};

    carString = carString.replace(/&nbsp;/ig, " ")

    var year = this.regexes.carYear.exec(carString);
    if (year && year.length > 0){
        result.year = parseInt(year.pop());
    }
    else {
        year = this.regexes.carYear.exec(carString);
        if (year && year.length > 0){
            result.year = parseInt(year.pop());
        }
        else {
            result.year = 0;
        }
    }

    var car = carString.substr(0, carString.indexOf('('));
    car = car.replace(/\&nbsp;/ig, " ").replace(/\s+/ig, " ").trim();
    var parseApiUrl = this.parseUrl.format(encodeURIComponent(car));

    $.ajax({
        global: false,
        async: true,
        url: parseApiUrl,
        type: "GET",
        dataType: "json"
    }).success(function(a,b,c){
        result.manufacturer_id = parseInt(a.result.manufacturer_id);
        result.model_id = parseInt(a.result.model_id);
        callback(result);
    }).error(function(a,b){
        callback(result);
    });


};

Api.prototype._parseNotes = function(order){

    var notes = order.notes;
    var auto = order.auto.replace(/\&nbsp;/ig, " ");

    if (notes){
        notes += "\r\n";
    }

    var start = auto.indexOf('(');
    var end = Math.max(auto.search("(\\d){4}(\\s){1}")-1, start);
    notes += auto.substring(start, end);

    return notes;

};

Api.prototype._parsePhone = function(order){

    if (!order.phone){
        return false;
    }

    var result = "";

    var ths = this;
    var phone = (order.phone || "00000000000").replace(/[^\d]/ig, "");
    var pos = 0;

    ths.phoneFormat.forEach(function(count){

        if ((pos >= phone.length)){
            return;
        }

        if ((pos==0) && phone.length > 9){
            if (phone.substr(0,1)=="7") {
                result += "+";
            }
            else if (phone.substr(0,1)=="8"){
                phone = "7" + phone.substr(1);
                result += "+";
            }
            else if (phone.length == 10){
                phone = "7" + phone;
                result += "+";
            }
        }

        result += ((pos > 0) ? "-" : "") + phone.substr(pos, count);
        pos += count;

    });

    return result;
};


Api.prototype.placeOrder = function(order, callback){

    var ths = this;

    if (!order.auto) {
        return calback();
    }

    ths._parseCarString(order.auto, function(car){

        car.vin = order.vin.replace("—", "").replace(/\W/gi, "");

        // currently hardcoded
        car.wheel = "left";
        car.body = "";
        car.engine = "";

        var parts = [];
        order.parts.forEach(function(part){
            var p = {
                amount: 1,
                part_name : part,
                type : car.vin ? [ "old", "new" ] : [ "old" ]
            };

            parts.push(p);
        });

        var phone = ths._parsePhone(order);
        if (!phone){
            // do not send orders with empty phone number
            return callback();
        }

        var cityId = ths._lookupCity(order.region);
        if (!cityId) {
            // do not send orders with cities not found
            return callback();
        }

        var data = {
            car : car,
            orderlist : parts,
            order : {
                notes: ths._parseNotes(order),
                show_phone: "no",
                city_id: cityId,
                id: order.id
            },
            user : {
                phone: phone,
                email: "",
                name: order.name
            }
        };

        console.log("Sending data to API:");
        console.log(data);
        // we're done, send request with data
        ths._sendRequest("orders", data, function(a){
            console.log("API: Place order response: ");
            console.log(a);
            if (a.error) {
                return callback(a.error());
            } else {
                return callback();
            }
        });

    });

};