var chai = require('chai');
var chaiHttp = require('chai-http');
const should = chai.should();
var _ = require('underscore');
chai.use(chaiHttp);

const Config = GLOBAL.Config;

const userUtils = require(Config.absPathInTestsFolder("utils/user/userUtils.js"));
const itemUtils = require(Config.absPathInTestsFolder("utils/item/itemUtils.js"));
const appUtils = require(Config.absPathInTestsFolder("utils/app/appUtils.js"));

const demouser1 = require(Config.absPathInTestsFolder("mockdata/users/demouser1.js"));
const demouser2 = require(Config.absPathInTestsFolder("mockdata/users/demouser2.js"));
const demouser3 = require(Config.absPathInTestsFolder("mockdata/users/demouser3.js"));

const publicProject = require(Config.absPathInTestsFolder("mockdata/projects/public_project.js"));
const invalidProject = require(Config.absPathInTestsFolder("mockdata/projects/invalidProject.js"));

const testFolder1 = require(Config.absPathInTestsFolder("mockdata/folders/testFolder1.js"));
const notFoundFolder = require(Config.absPathInTestsFolder("mockdata/folders/notFoundFolder.js"));
const folderForDemouser2 = require(Config.absPathInTestsFolder("mockdata/folders/folderDemoUser2"));
var addMetadataToFoldersUnit = appUtils.requireUncached(Config.absPathInTestsFolder("units/metadata/addMetadataToFolders.Unit.js"));
var db = appUtils.requireUncached(Config.absPathInTestsFolder("utils/db/db.Test.js"));

describe("Public project testFolder1 level ?change_log", function () {
    before(function (done) {
        this.timeout(60000);
        addMetadataToFoldersUnit.setup(function (err, results) {
            should.equal(err, null);
            done();
        });
    });

    describe("[GET] [PUBLIC PROJECT] /project/" + publicProject.handle + "/data/foldername?change_log", function () {
        it("Should give the change log if the user is unauthenticated", function (done) {
            var app = GLOBAL.tests.app;
            var agent = chai.request.agent(app);

            itemUtils.getItemChangeLog(true, agent, publicProject.handle, testFolder1.name, function (err, res) {
                res.statusCode.should.equal(200);//because it is a public project
                res.body[0].changes.length.should.equal(3);//The abstract, title and creator descriptors
                done();
            });
        });

        it("Should give an error if the project does not exist", function (done) {
            userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
                itemUtils.getItemChangeLog(true, agent, invalidProject.handle, testFolder1.name, function (err, res) {
                    res.statusCode.should.equal(200);
                    res.redirects.length.should.equal(1);//this is an error case but the error response is sent as an html as a redirect with the flash message which is not accessible by the html response
                    done();
                });
            });
        });

        it("Should give an error if the folder identified by foldername does not exist", function (done) {
            userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
                itemUtils.getItemChangeLog(true, agent, publicProject.handle, notFoundFolder.name, function (err, res) {
                    res.statusCode.should.equal(200);
                    res.redirects.length.should.equal(1);//this is an error case but the error response is sent as an html as a redirect with the flash message which is not accessible by the html response
                    done();
                });
            });
        });

        it("Should give the change log if the user is logged in as demouser3(not a collaborator nor creator of the project)", function (done) {
            userUtils.loginUser(demouser3.username, demouser3.password, function (err, agent) {
                itemUtils.getItemChangeLog(true, agent, publicProject.handle, testFolder1.name, function (err, res) {
                    res.statusCode.should.equal(200);//because the project is public
                    res.body[0].changes.length.should.equal(3);//The abstract, title and creator descriptors
                    done();
                });
            });
        });

        it("Should give the change log related to the folder if the folder exists and if the user is logged in as demouser1(the creator of the project)", function (done) {
            //jsonOnly, agent, projectHandle, itemPath, cb
            userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
                itemUtils.getItemChangeLog(true, agent, publicProject.handle, testFolder1.name, function (err, res) {
                    res.statusCode.should.equal(200);
                    res.body[0].changes.length.should.equal(3);//The abstract, title and creator descriptors
                    done();
                });
            });
        });

        it("Should give the change log related to the folder if the folder exists and if the user is logged in as demouser2(a collaborator on the project)", function (done) {
            userUtils.loginUser(demouser2.username, demouser2.password, function (err, agent) {
                itemUtils.getItemChangeLog(true, agent, publicProject.handle, testFolder1.name, function (err, res) {
                    res.statusCode.should.equal(200);
                    res.body[0].changes.length.should.equal(3);//The abstract, title and creator descriptors
                    done();
                });
            });
        });
    });

    after(function (done) {
        //destroy graphs
        this.timeout(60000);
        appUtils.clearAppState(function (err, data) {
            should.equal(err, null);
            done();
        });
    });
});