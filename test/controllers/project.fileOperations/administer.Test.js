process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

var Config = function() { return GLOBAL.Config; }();
var Project = require(Config.absPathInSrcFolder("/models/project.js")).Project;
var User = require(Config.absPathInSrcFolder("/models/user.js")).User;

const should = chai.should();
const expect = chai.expect();

const publicProject = require("../../mockdata/projects/public_project.js");
const metadataOnlyProject = require("../../mockdata/projects/metadata_only_project.js");
const privateProject= require("../../mockdata/projects/private_project.js");

var projectUtils = require('./../../utils/project/projectUtils.js');
var userUtils = require('./../../utils/user/userUtils.js');

var demouser1 = require("../../mockdata/users/demouser1");
var demouser2 = require("../../mockdata/users/demouser2");
var demouser3 = require("../../mockdata/users/demouser3");
var demouser4 = require("../../mockdata/users/demouser4");
var demouser5 = require("../../mockdata/users/demouser5");



describe('/project/' + publicProject.handle + '?administer', function () {

    it("[HTML] should not access project without logging in GET", function (done) {
        var app = GLOBAL.tests.app;
        var agent = chai.request.agent(app);
        projectUtils.administer(agent, false, {}, publicProject.handle, function(err, res){
            res.should.have.status(200);
            res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
            done();
        });
    });

    it("[HTML] should not access project without admin rights GET", function (done) {
        userUtils.loginUser(demouser2.username, demouser2.password, function (err, agent) {
            projectUtils.administer(agent, false, {}, publicProject.handle, function(err, res){
                res.should.have.status(200);
                res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
                done();
            });
        });
    });

    it("[HTML] should access project's info GET", function (done) {

        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            //
            // SELECT *
            // FROM
            // <http://127.0.0.1:3001/dendro_graph>
            // WHERE
            // {
            // <http://127.0.0.1:3001/project/publicprojectcreatedbydemouser1> ?p ?o
            //     }
            projectUtils.administer(agent, false, {}, publicProject.handle, function(err, res){
                res.should.have.status(200);
                res.text.should.contain('Editing project "' + publicProject.title + '"');
                done();
            });
        });
    });

    it("[HTML] should not access admin in folder GET", function (done) {

        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, false, {}, privateProject.handle + '/data/pastinhaLinda', function (err, res) {
                res.should.have.status(404);
                should.exist(err);
                err.message.should.equal('Not Found');
                done();
            });
        });
    });

    it("[HTML] should not access admin in folder POST", function (done) {

        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, true, {}, privateProject.handle + '/data/pastinhaLinda', function (err, res) {
                res.should.have.status(404);
                should.exist(err);
                err.message.should.equal('Not Found');
                done();
            });
        });
    });

    it("[HTML] should not modify project without logging in POST", function (done) {
        var app = GLOBAL.tests.app;
        var agent = chai.request.agent(app);
        projectUtils.administer(agent, true, {}, publicProject.handle, function(err, res){
            res.should.have.status(200);
            res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
            done();
        });
    });

    it("[HTML] should not modify project without admin rights POST", function (done) {
        userUtils.loginUser(demouser2.username, demouser2.password, function (err, agent) {
            projectUtils.administer(agent, true, {}, publicProject.handle, function(err, res){
                res.should.have.status(200);
                res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
                done();
            });
        });
    });

    it("[HTML] should change project's privacy status, title and description", function (done) {
        var metadata = 'metadata_only';
        var title = 'mockTitle';
        var description = 'this is a testing description with no other purposes';
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, true, {privacy: metadata, title: title, description: description}, publicProject.handle, function(err, res){
                res.should.have.status(200);
                Project.findByHandle(publicProject.handle, function(err, project){
                    project.ddr.privacyStatus.should.equal(metadata);
                    project.dcterms.title.should.equal(title);
                    project.dcterms.description.should.equal(description);
                    done();
                });

            });
        });
    });

    it("[HTML] add non-existent contributors", function (done) {
        var invalidUsername = 'nonexistinguser';
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, true, {contributors: [invalidUsername]}, publicProject.handle, function(err, res){
                res.should.have.status(200);
                res.text.should.contain("error_messages");
                res.text.should.contain(invalidUsername);
                done();
            });
        });

    });

    it("[HTML] add contributors", function (done) {
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            User.findByUsername(demouser4.username, function(err, user){
                var user4data = user;
                Project.findByHandle(publicProject.handle, function(err, project){
                    var contributor = project.dcterms.contributor;
                    projectUtils.administer(agent, true, {contributors: [contributor, demouser5.username, user4data.uri ]}, publicProject.handle, function(err, res){
                        Project.findByHandle(publicProject.handle, function(err, project){
                            var contributors = project.dcterms.contributor;
                            contributors.length.should.equal(3);
                            if(contributors[2].includes(demouser5.username))
                                contributors[2].should.contain(demouser5.username);
                            else contributors[1].should.contain(demouser5.username);
                            contributors.should.include(user4data.uri);
                            done();
                        });
                    });
                });
            });

        });
    });


    it("[HTML] remove contributors", function (done) {
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            Project.findByHandle(publicProject.handle, function(err, project){
                project.dcterms.contributor.length.should.equal(3);
                projectUtils.administer(agent, true, {contributors: [demouser2.username]}, publicProject.handle, function(err, res) {
                    Project.findByHandle(publicProject.handle, function(err, project) {
                        project.dcterms.contributor.should.contain(demouser2.username);
                        done();
                    });
                });
            });
        });
    });
});


describe('/project/' + privateProject.handle + '?administer', function () {

    it("[HTML] should not access project without logging in GET", function (done) {
        var app = GLOBAL.tests.app;
        var agent = chai.request.agent(app);
        projectUtils.administer(agent, false, {}, privateProject.handle, function (err, res) {
            res.should.have.status(200);
            res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
            done();
        });
    });

    it("[HTML] should not access project without admin rights GET", function (done) {
        userUtils.loginUser(demouser2.username, demouser2.password, function (err, agent) {
            projectUtils.administer(agent, false, {}, privateProject.handle, function (err, res) {
                res.should.have.status(200);
                res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
                done();
            });
        });
    });

    it("[HTML] should access project's info GET", function (done) {

        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            //
            // SELECT *
            // FROM
            // <http://127.0.0.1:3001/dendro_graph>
            // WHERE
            // {
            // <http://127.0.0.1:3001/project/privateProjectcreatedbydemouser1> ?p ?o
            //     }
            projectUtils.administer(agent, false, {}, privateProject.handle, function (err, res) {
                res.should.have.status(200);
                res.text.should.contain('Editing project "' + privateProject.title + '"');
                done();
            });
        });
    });

    it("[HTML] should not access admin in folder GET", function (done) {

        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, false, {}, privateProject.handle + '/data/pastinhaLinda', function (err, res) {
                res.should.have.status(404);
                should.exist(err);
                err.message.should.equal('Not Found');
                done();
            });
        });
    });

    it("[HTML] should not access admin in folder POST", function (done) {

        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, true, {}, privateProject.handle + '/data/pastinhaLinda', function (err, res) {
                res.should.have.status(404);
                should.exist(err);
                err.message.should.equal('Not Found');
                done();
            });
        });
    });

    it("[HTML] should not modify project without logging in POST", function (done) {
        var app = GLOBAL.tests.app;
        var agent = chai.request.agent(app);
        projectUtils.administer(agent, true, {}, privateProject.handle, function (err, res) {
            res.should.have.status(200);
            res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
            done();
        });
    });

    it("[HTML] should not modify project without admin rights POST", function (done) {
        userUtils.loginUser(demouser2.username, demouser2.password, function (err, agent) {
            projectUtils.administer(agent, true, {}, privateProject.handle, function (err, res) {
                res.should.have.status(200);
                res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
                done();
            });
        });
    });

    it("[HTML] should change project's privacy status, title and description", function (done) {
        var metadata = 'metadata_only';
        var private = 'private';
        var title = 'mockTitle';
        var description = 'this is a testing description with no other purposes';
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, true, {
                privacy: metadata,
                title: title,
                description: description
            }, privateProject.handle, function (err, res) {
                res.should.have.status(200);
                Project.findByHandle(privateProject.handle, function (err, project) {
                    project.ddr.privacyStatus.should.equal(metadata);
                    project.dcterms.title.should.equal(title);
                    project.dcterms.description.should.equal(description);
                    done();
                    projectUtils.administer(agent, true, {
                        privacy: private
                    }, privateProject.handle, function (err, res) {
                        res.should.have.status(200);
                        Project.findByHandle(privateProject.handle, function (err, project) {
                            project.ddr.privacyStatus.should.equal(private);
                        });
                    });
                });

            });
        });
    });

    it("[HTML] add non-existent contributors", function (done) {
        var invalidUsername = 'nonexistinguser';
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, true, {contributors: [invalidUsername]}, privateProject.handle, function (err, res) {
                res.should.have.status(200);
                res.text.should.contain("error_messages");
                res.text.should.contain(invalidUsername);
                done();
            });
        });

    });

    it("[HTML] add contributors", function (done) {
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            User.findByUsername(demouser4.username, function(err, user){
                var user4data = user;
                Project.findByHandle(privateProject.handle, function(err, project){
                    var contributor = project.dcterms.contributor;
                    projectUtils.administer(agent, true, {contributors: [contributor, demouser5.username, user4data.uri ]}, privateProject.handle, function(err, res){
                        Project.findByHandle(privateProject.handle, function(err, project){
                            var contributors = project.dcterms.contributor;
                            contributors.length.should.equal(3);
                            if(contributors[2].includes(demouser5.username))
                                contributors[2].should.contain(demouser5.username);
                            else contributors[1].should.contain(demouser5.username);
                            contributors.should.include(user4data.uri);
                            done();
                        });
                    });
                });
            });

        });
    });


    it("[HTML] remove contributors", function (done) {
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            Project.findByHandle(privateProject.handle, function(err, project){
                project.dcterms.contributor.length.should.equal(3);
                projectUtils.administer(agent, true, {contributors: [demouser2.username]}, privateProject.handle, function(err, res) {
                    Project.findByHandle(privateProject.handle, function(err, project) {
                        project.dcterms.contributor.should.contain(demouser2.username);
                        done();
                    });
                });
            });
        });
    });
});



describe('/project/' + metadataOnlyProject.handle + '?administer', function () {

    it("[HTML] should not access project without logging in GET", function (done) {
        var app = GLOBAL.tests.app;
        var agent = chai.request.agent(app);
        projectUtils.administer(agent, false, {}, metadataOnlyProject.handle, function (err, res) {
            res.should.have.status(200);
            res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
            done();
        });
    });

    it("[HTML] should not access project without admin rights GET", function (done) {
        userUtils.loginUser(demouser2.username, demouser2.password, function (err, agent) {
            projectUtils.administer(agent, false, {}, metadataOnlyProject.handle, function (err, res) {
                res.should.have.status(200);
                res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
                done();
            });
        });
    });

    it("[HTML] should access project's info GET", function (done) {

        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            //
            // SELECT *
            // FROM
            // <http://127.0.0.1:3001/dendro_graph>
            // WHERE
            // {
            // <http://127.0.0.1:3001/project/metadataOnlyProjectcreatedbydemouser1> ?p ?o
            //     }
            projectUtils.administer(agent, false, {}, metadataOnlyProject.handle, function (err, res) {
                res.should.have.status(200);
                res.text.should.contain('Editing project "' + metadataOnlyProject.title + '"');
                done();
            });
        });
    });

    it("[HTML] should not access admin in folder GET", function (done) {

        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, false, {}, metadataOnlyProject.handle + '/data/pastinhaLinda', function (err, res) {
                res.should.have.status(404);
                should.exist(err);
                err.message.should.equal('Not Found');
                done();
            });
        });
    });

    it("[HTML] should not access admin in folder POST", function (done) {

        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, true, {}, metadataOnlyProject.handle + '/data/pastinhaLinda', function (err, res) {
                res.should.have.status(404);
                should.exist(err);
                err.message.should.equal('Not Found');
                done();
            });
        });
    });

    it("[HTML] should not modify project without logging in POST", function (done) {
        var app = GLOBAL.tests.app;
        var agent = chai.request.agent(app);
        projectUtils.administer(agent, true, {}, metadataOnlyProject.handle, function (err, res) {
            res.should.have.status(200);
            res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
            done();
        });
    });

    it("[HTML] should not modify project without admin rights POST", function (done) {
        userUtils.loginUser(demouser2.username, demouser2.password, function (err, agent) {
            projectUtils.administer(agent, true, {}, metadataOnlyProject.handle, function (err, res) {
                res.should.have.status(200);
                res.text.should.contain('Permission denied : cannot access the administration area of the project because you are not its creator.');
                done();
            });
        });
    });

    it("[HTML] should change project's privacy status, title and description", function (done) {
        var public = 'public';
        var title = 'mockTitle';
        var description = 'this is a testing description with no other purposes';
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, true, {
                privacy: public,
                title: title,
                description: description
            }, metadataOnlyProject.handle, function (err, res) {
                res.should.have.status(200);
                Project.findByHandle(metadataOnlyProject.handle, function (err, project) {
                    project.ddr.privacyStatus.should.equal(public);
                    project.dcterms.title.should.equal(title);
                    project.dcterms.description.should.equal(description);
                    done();
                });

            });
        });
    });

    it("[HTML] should not add non-existent contributors", function (done) {
        var invalidUsername = 'nonexistinguser';
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            projectUtils.administer(agent, true, {contributors: [invalidUsername]}, metadataOnlyProject.handle, function (err, res) {
                res.should.have.status(200);
                res.text.should.contain("error_messages");
                res.text.should.contain(invalidUsername);
                done();

            });
        });

    });

    it("[HTML] add contributors", function (done) {
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            User.findByUsername(demouser4.username, function(err, user){
                var user4data = user;
                Project.findByHandle(metadataOnlyProject.handle, function(err, project){
                    var contributor = project.dcterms.contributor;
                    projectUtils.administer(agent, true, {contributors: [contributor, demouser5.username, user4data.uri ]}, metadataOnlyProject.handle, function(err, res){
                        Project.findByHandle(metadataOnlyProject.handle, function(err, project){
                            var contributors = project.dcterms.contributor;
                            contributors.length.should.equal(3);
                            if(contributors[2].includes(demouser5.username))
                                contributors[2].should.contain(demouser5.username);
                            else contributors[1].should.contain(demouser5.username);
                            contributors.should.include(user4data.uri);
                            done();
                        });
                    });
                });
            });

        });
    });

    it("[HTML] remove contributors", function (done) {
        userUtils.loginUser(demouser1.username, demouser1.password, function (err, agent) {
            Project.findByHandle(metadataOnlyProject.handle, function(err, project){
                project.dcterms.contributor.length.should.equal(3);
                projectUtils.administer(agent, true, {contributors: [demouser2.username]}, metadataOnlyProject.handle, function(err, res) {
                    Project.findByHandle(metadataOnlyProject.handle, function(err, project) {
                        project.dcterms.contributor.should.contain(demouser2.username);
                        done();
                    });
                });
            });
        });
    });
});
