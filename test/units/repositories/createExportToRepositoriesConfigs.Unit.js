process.env.NODE_ENV = 'test';

const Pathfinder = global.Pathfinder;
const Config = global.Config;
const async = require('async');
const userUtils = require(Pathfinder.absPathInTestsFolder("utils/user/userUtils.js"));
const repositoryUtils = require(Pathfinder.absPathInTestsFolder("utils/repository/repositoryUtils.js"));

const demouser1 = require(Pathfinder.absPathInTestsFolder("mockdata/users/demouser1"));

const b2share = require(Pathfinder.absPathInTestsFolder("mockdata/repositories/dataToCreate/b2share"));
const ckan = require(Pathfinder.absPathInTestsFolder("mockdata/repositories/dataToCreate/ckan"));
const dspace = require(Pathfinder.absPathInTestsFolder("mockdata/repositories/dataToCreate/dspace"));
const eprints = require(Pathfinder.absPathInTestsFolder("mockdata/repositories/dataToCreate/eprints"));
const figshare = require(Pathfinder.absPathInTestsFolder("mockdata/repositories/dataToCreate/figshare"));
const zenodo = require(Pathfinder.absPathInTestsFolder("mockdata/repositories/dataToCreate/zenodo"));

const dataToCreateExportConfigs = [b2share, ckan, dspace, eprints, figshare, zenodo];

function requireUncached(module) {
    delete require.cache[require.resolve(module)]
    return require(module)
}

module.exports.setup = function(finish)
{
    let addMetadataToFoldersUnit = requireUncached(Pathfinder.absPathInTestsFolder("units/metadata/addMetadataToFolders.Unit.js"));

    addMetadataToFoldersUnit.setup(function (err, results) {
        if(err)
        {
            finish(err, results);
        }
        else
        {
            async.mapSeries(dataToCreateExportConfigs, function (dataConfig, cb) {
                userUtils.loginUser(demouser1.username,demouser1.password, function (err, agent) {
                    if(err)
                    {
                        cb(err, agent);
                    }
                    else
                    {
                        repositoryUtils.createExportConfig(true, agent, dataConfig, function (err, res) {
                            cb(err, res);
                        });
                    }
                });
            }, function (err, results) {
                finish(err, results);
            });
        }
    });
};