var path = require('path');
var async = require('async');

var PluginConfig = require("./config.json");

const Config = function () {
    return GLOBAL.Config;
}();

const isNull = require(Config.absPathInSrcFolder("/utils/null.js")).isNull;
var DendroInteraction2CSV = require(Config.absPathInPluginsFolder(path.join(PluginConfig.plugin_folder_name, "dendro_interaction2csv.js"))).DendroInteraction2CSV;

function Setup ()
{

}

Setup.registerRoutes = function(app)
{
    return DendroInteraction2CSV.setup(app);
};

module.exports.Setup = Setup;