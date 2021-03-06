/**
 * Created by Fábio on 31/03/2016.
 */
const Config = function () {
    return GLOBAL.Config;
}();

const isNull = require(Config.absPathInSrcFolder("/utils/null.js")).isNull;

B2Share.apiURL = Config.eudatBaseUrl + "/api";
B2Share.depositionURL = B2Share.apiURL + "/deposition/";
B2Share.depositionsURL = B2Share.apiURL + "/depositions";
B2Share.depositionFilesPath =  "/files";
B2Share.commitDepositionPath = "/commit";
B2Share.recordPath = Config.eudatBaseUrl + "/record";

const request = require('request');

function B2Share(accessToken){
    if(isNull(accessToken)){
        throw "Undefined Access Token";
    }
    else{
        this.accessToken = accessToken;
    }
}
B2Share.prototype.createDeposition = function(callback){
    request.post({
        url: B2Share.depositionsURL + "?access_token=" + this.accessToken,
        rejectUnauthorized: false
    }, function(error, result, deposition){
        if(error){
            console.log("[B2SHARE] Deposition Error: " + error);
            return callback(true);
        }
        else{
            if(result.statusCode !== 201){
                console.log("[B2SHARE] Deposition Error: " + JSON.stringify(result));
                return callback(true);
            }
            else{
                console.log("[B2SHARE] Deposition Created");
                return callback(false, deposition);
            }
        }
    });
};

B2Share.prototype.uploadFileToDeposition = function(depositionID, file, callback){
    const fs = require('fs');
    const r = request.post({
        url: B2Share.depositionURL + depositionID + B2Share.depositionFilesPath + "?access_token=" + this.accessToken,
        json: true,
        rejectUnauthorized: false
    }, function (error, result, data) {
        if (error) {
            console.log("[B2SHARE] File Upload error: " + error);
            return callback(true);
        }
        else {
            if (result.statusCode !== 200) {
                console.log("[B2SHARE] File Upload error:" + JSON.stringify(result));
                return callback(true);
            }
            else {
                console.log("[B2SHARE] Success Uploading File");
                return callback(false);
            }
        }
    });

    const form = r.form();
    form.append('file', fs.createReadStream(file));
};

B2Share.prototype.uploadMultipleFilesToDeposition = function (depositionID, files, callback) {
    const async = require('async');
    const self = this;

    async.each(files, function(file, callback){
        self.uploadFileToDeposition(depositionID, file, function(error){
            if(error){
                return callback(true);
            }
            else{
                return callback(false);
            }
        });
    }, function(error){
        if(error){
            return callback(true);
        }
        else{
            return callback(false);
        }
    });
};

B2Share.prototype.depositionPublish = function(depositionID, metadata, callback){
    request.post({
        url: B2Share.depositionURL + depositionID + B2Share.commitDepositionPath + "?access_token=" + this.accessToken,
        json: true,
        body: metadata,
        rejectUnauthorized: false
    }, function(error, result, data){
        if(error){
            console.log("[B2SHARE] Error Publishing Dataset: " + error);
            return callback(true);
        }
        else{
            if(result.statusCode !== 201){
                console.log("[B2SHARE] Error Publishing Dataset:" + JSON.stringify(result));
                return callback(true);
            }
            else{
                console.log("[B2SHARE] Success Committing Deposit: " + JSON.stringify(result));
                return callback(false, result);
            }
        }
    });
};

module.exports = B2Share;