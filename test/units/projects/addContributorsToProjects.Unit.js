process.env.NODE_ENV = 'test';

const Pathfinder = global.Pathfinder;
const Config = global.Config;

const chai = require('chai');
chai.use(require('chai-http'));
const async = require('async');
const should = chai.should();
const colors = require('colors');

const projectUtils = require(Pathfinder.absPathInTestsFolder("utils/project/projectUtils.js"));
const userUtils = require(Pathfinder.absPathInTestsFolder("utils/user/userUtils.js"));
const folderUtils = require(Pathfinder.absPathInTestsFolder("utils/folder/folderUtils.js"));

const demouser1 = require(Pathfinder.absPathInTestsFolder("mockdata/users/demouser1"));
const demouser2 = require(Pathfinder.absPathInTestsFolder("mockdata/users/demouser2"));

const publicProjectData = require(Pathfinder.absPathInTestsFolder("mockdata/projects/public_project.js"));
const metadataOnlyProjectData = require(Pathfinder.absPathInTestsFolder("mockdata/projects/metadata_only_project.js"));
const privateProjectData = require(Pathfinder.absPathInTestsFolder("mockdata/projects/private_project.js"));

const publicProjectForHTMLTestsData = require(Pathfinder.absPathInTestsFolder("mockdata/projects/public_project_for_html.js"));
const metadataOnlyProjectForHTMLTestsData = require(Pathfinder.absPathInTestsFolder("mockdata/projects/metadata_only_project_for_html.js"));
const privateProjectForHTMLTestsData = require(Pathfinder.absPathInTestsFolder("mockdata/projects/private_project_for_html.js"));

function requireUncached(module) {
    delete require.cache[require.resolve(module)]
    return require(module)
}

const start = function()
{
    if(Config.debug.tests.log_unit_completion_and_startup)
    {
        console.log("**********************************************".green);
        console.log("[Adding contributors unit] Adding contributors to projects...".green);
        console.log("**********************************************".green);
    }
};

const end = function()
{
    if(Config.debug.tests.log_unit_completion_and_startup)
    {
        console.log("**********************************************".blue);
        console.log("[Adding contributors unit] Complete.".blue);
        console.log("**********************************************".blue);
    }
};

module.exports.setup = function(finish)
{
    start();
    const projectsData = [publicProjectData, metadataOnlyProjectData, privateProjectData, publicProjectForHTMLTestsData, metadataOnlyProjectForHTMLTestsData, privateProjectForHTMLTestsData];
    let createProjectsUnit = requireUncached(Pathfinder.absPathInTestsFolder("units/projects/createProjects.Unit.js"));

    createProjectsUnit.setup(function (err, results) {
        if(err)
        {
            finish(err, results);
            end();
        }
        else
        {
            async.mapSeries(projectsData, function (projectData, cb) {
                userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
                    if(err)
                    {
                        cb(err, agent);
                    }
                    else
                    {
                        userUtils.addUserAscontributorToProject(true, agent, demouser2.username, projectData.handle, function (err, res) {
                            cb(err, res);
                        });
                    }
                });
            }, function (err, results) {
                //should.equal(err, null);
                finish(err, results);
                end();
            });
        }
    });
};