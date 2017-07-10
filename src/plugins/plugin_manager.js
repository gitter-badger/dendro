const fs = require('fs');
const path = require('path');
const _ = require('underscore');

const Pathfinder = require(path.join(process.cwd(), "src", "models", "meta", "pathfinder.js")).Pathfinder;
const Config = require(path.join(process.cwd(), "src", "models", "meta", "config.js")).Config;
const isNull = require(Pathfinder.absPathInSrcFolder("/utils/null.js")).isNull;

function PluginManager ()
{
    var self = this;
}

PluginManager.registerPlugins = function(app, callback)
{
    var pluginsFolderAbsPath = Pathfinder.getAbsolutePathToPluginsFolder();

    var files = fs.readdirSync(pluginsFolderAbsPath);

    files = _.without(files, "conf");

    for(var i = 0; i < files.length; i++)
    {
        var fileName = files[i];

        var isHiddenFile = function(fileName)
        {
            for(var i = 0; i < Config.systemOrHiddenFilesRegexes.length; i++)
            {
                var regex = new RegExp(Config.systemOrHiddenFilesRegexes[i]);

                if(fileName.match(regex))
                {
                    return true;
                }
            }

            return false;
        };

        if(!isHiddenFile(fileName))
        {
            var pluginAbsolutePath = path.join(pluginsFolderAbsPath, fileName);

            var stats = fs.statSync(pluginAbsolutePath);

            if(stats.isDirectory())
            {
                var configFileLocation = pluginAbsolutePath + "/integration/config.json";
                var PluginConfig = require(configFileLocation);

                var setupFileLocation = pluginAbsolutePath + "/integration/setup.js";
                var PluginSetup = require(setupFileLocation).Setup;

                console.log("[INFO] Registering routes for plugin " + PluginConfig.name);
                app = PluginSetup.registerRoutes(app);
            }
        }
    }

    callback(null, app);
};

module.exports.PluginManager = PluginManager;