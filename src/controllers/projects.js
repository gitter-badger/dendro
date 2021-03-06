const Config = function () {
    return GLOBAL.Config;
}();

const isNull = require(Config.absPathInSrcFolder("/utils/null.js")).isNull;

const Ontology = require(Config.absPathInSrcFolder("/models/meta/ontology.js")).Ontology;
const Project = require(Config.absPathInSrcFolder("/models/project.js")).Project;
const Folder = require(Config.absPathInSrcFolder("/models/directory_structure/folder.js")).Folder;
const File = require(Config.absPathInSrcFolder("/models/directory_structure/file.js")).File;
const Descriptor = require(Config.absPathInSrcFolder("/models/meta/descriptor.js")).Descriptor;
const Permissions = require(Config.absPathInSrcFolder("/models/meta/permissions.js")).Permissions;
const User = require(Config.absPathInSrcFolder("/models/user.js")).User;
const DbConnection = require(Config.absPathInSrcFolder("/kb/db.js")).DbConnection;

const nodemailer = require('nodemailer');
const db = function () {
    return GLOBAL.db.default;
}();
const flash = require('connect-flash');
const async = require('async');

exports.all = function(req, res) {

    let viewVars = {
        title: "All projects"
    };

    viewVars = DbConnection.paginate(req,
        viewVars
    );

    const validateRequestType = function (cb) {
        let acceptsHTML = req.accepts('html');
        const acceptsJSON = req.accepts('json');

        if (acceptsJSON && !acceptsHTML) {
            res.status(400).json({
                result: "error",
                message: "API Request not valid for this route."
            })
        }
        else {
            cb(null, null);
        }

    };

    const getProjectCount = function (cb) {
        Project.getCount(function (err, count) {
            cb(err, count);
        });
    };

    const getAllProjects = function (cb) {
        if (req.session.isAdmin) {
            Project.all(function (err, projects) {
                cb(err, projects);
            }, req);
        }
        else if (!isNull(req.user) && !isNull(req.user.uri)) {

            Project.allNonPrivateUnlessTheyBelongToMe(req.user, function (err, projects) {
                cb(err, projects);
            }, req);
        }
        else {
            Project.allNonPrivate(req.user, function (err, projects) {
                cb(err, projects);
            }, req);
        }

    };

    async.series(
        [
            validateRequestType, getProjectCount, getAllProjects
        ], function (err, results)
        {
            if (!err)
            {
                viewVars.count = results[1];
                viewVars.projects = results[2];

                res.render('projects/all',
                    viewVars
                )
            }
            else
            {
                viewVars.projects = [];
                viewVars.error_messages = [results];
                res.render('projects/all',
                    viewVars
                )
            }
        }
    );
};

exports.my = function(req, res) {

    let viewVars = {
        //title: "My projects"
    };

    Project.findByCreatorOrContributor(req.user.uri, function(err, projects) {
        if(!err && typeof projects != null)
        {
            let acceptsHTML = req.accepts('html');
            const acceptsJSON = req.accepts('json');

            if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
            {
                res.json(
                    {
                        projects : projects
                    }
                );
            }
            else
            {
                viewVars = DbConnection.paginate(req,
                    viewVars
                );

                viewVars.projects = projects;
                res.render('projects/my',
                    viewVars
                );
            }
        }
        else
        {
            viewVars.projects = [];
            viewVars.info_messages = ["You have not created any projects"];
            res.render('projects/my',
                viewVars
            );
        }
    });
};
exports.change_log = function(req, res){

    const fetchVersionsInformation = function (archivedResource, cb) {
        archivedResource.getDetailedInformation(function (err, result) {
            cb(err, result);
        });
    };

    //TODO make this an InformationElement instead of only a folder
    Folder.findByUri(req.params.requestedResource, function(err, containingFolder)
    {
        if(!err && containingFolder !== "undefined" && containingFolder instanceof Folder)
        {
            Project.findByHandle(req.params.handle, function(err, project) {
                if(!err && !isNull(project))
                {
                    let offset;

                    try{
                        offset = req.params.page * Config.change_log.default_page_length;
                    }
                    catch(e)
                    {
                        offset = 0;
                    }

                    containingFolder.getArchivedVersions(offset, Config.change_log.default_page_length, function(err, archivedResources)
                    {
                        if(!err)
                        {
                            async.map(archivedResources, fetchVersionsInformation, function(err, fullVersions){
                                if(!err)
                                {
                                    res.json(fullVersions);
                                }
                                else
                                {
                                    const flash = require('connect-flash');
                                    flash('error', "Unable to fetch descriptors. Reported Error: " + fullVersions);
                                    res.redirect('back');
                                }
                            });
                        }
                        else
                        {
                            var flash = require('connect-flash');
                            flash('error', "Unable to fetch project revisions. Reported Error: " + archivedResources);
                            res.redirect('back');
                        }
                    });

                }
                else
                {
                    var flash = require('connect-flash');
                    flash('error', "Unable to fetch contents of folder");
                    res.redirect('back');
                }
            });
        }
        else
        {
            var flash = require('connect-flash');
            flash('error', "Unable to fetch project");
            if(!res._headerSent)
            {
                res.redirect('back');
            }
        }
    });
};

exports.show = function(req, res) {
    const userIsLoggedIn = req.user ? true : false;

    if(!isNull(req.params.requestedResource))
    {
        var resourceURI	= req.params.requestedResource;
    }
    else if(req.params.handle)
    {
        var project = new Project(
            {
                ddr:
                    {
                        handle: req.params
                    }
            }
        );

        var resourceURI = project.uri;
    }

    function sendResponse(viewVars, requestedResource)
    {
        const askedForHtml = function (req, res) {
            const accept = req.header('Accept');
            let serializer = null;
            let contentType = null;
            if (accept in Config.metadataSerializers) {
                serializer = Config.metadataSerializers[accept];
                contentType = Config.metadataContentTypes[accept];

                if (!isNull(req.query.deep)) {
                    requestedResource.findMetadataRecursive(function (err, result) {
                        if (!err) {
                            res.set('Content-Type', contentType);
                            res.send(serializer(result));

                        }
                        else {
                            res.status(500).json({
                                error_messages: "Error finding metadata from " + requestedResource.uri + "\n" + result
                            });
                        }
                    });
                }
                else {
                    requestedResource.findMetadata(function (err, result) {
                        if (!err) {

                            res.set('Content-Type', contentType);
                            res.send(serializer(result));

                        }
                        else {
                            res.status(500).json({
                                error_messages: "Error finding metadata from " + requestedResource.uri + "\n" + result
                            });
                        }
                    });
                }

                return false;
            }
            else {
                return true;
            }
        };

        const _ = require('underscore');
        const isEditor = _.filter(req.permissions_management.reasons_for_authorizing, function (authorization) {
            const reason = authorization.role;
            return _.isEqual(reason, Permissions.role.project.creator) || _.isEqual(reason, Permissions.role.project.contributor) || _.isEqual(reason, Permissions.role.system.admin);
        });

        if(isEditor.length > 0)
        {
            if(askedForHtml(req, res))
            {
                res.render('projects/show',
                    viewVars
                );
            }
        }
        else
        {
            const isPublicOrMetadataOnlyProject = _.filter(req.permissions_management.reasons_for_authorizing, function (authorization) {
                const reason = authorization.role;
                return _.isEqual(reason, Permissions.project_privacy_status.metadata_only) || _.isEqual(reason, Permissions.project_privacy_status.public) || _.isEqual(reason, Permissions.role.system.admin);
            });

            const isPublicProject = _.filter(req.permissions_management.reasons_for_authorizing, function (authorization) {
                const reason = authorization.role;
                return _.isEqual(reason, Permissions.project_privacy_status.public) || _.isEqual(reason, Permissions.role.system.admin);
            });

            const isMetadataOnlyProject = _.filter(req.permissions_management.reasons_for_authorizing, function (authorization) {
                const reason = authorization.role;
                return _.isEqual(reason, Permissions.project_privacy_status.metadata_only) || _.isEqual(reason, Permissions.role.system.admin);
            });

            if(isPublicOrMetadataOnlyProject.length > 0)
            {
                if(askedForHtml(req, res))
                {
                    res.render('projects/show_readonly',
                        viewVars
                    );
                }
            }
            else if(isPublicProject.length > 0)
            {
                if(askedForHtml(req, res))
                {
                    res.render('projects/show_readonly',
                        viewVars
                    );
                }

            }
            else if(isMetadataOnlyProject.length > 0)
            {
                if(askedForHtml(req, res))
                {
                    res.render('projects/show_metadata',
                        viewVars
                    );
                }
            }
        }
    }

    if(typeof req.query.show_history !== "undefined")
    {
        var showing_history = 1;
    }
    else
    {
        var showing_history = 0;
    }

    const fetchVersionsInformation = function (archivedResource, cb) {
        archivedResource.getDetailedInformation(function (err, result) {
            cb(err, result);
        });
    };

    var viewVars = {
        showing_history : showing_history,
        Descriptor : Descriptor
    };

    if(isNull(req.params.filepath))
    {
        viewVars.read_only = true;
        viewVars.showing_project_root = 1;

        Project.findByHandle(req.params.handle, function(err, project) {
            if(!err && !isNull(project))
            {
                viewVars.project = project;
                viewVars.title = project.dcterms.title;
                viewVars.subtitle = "(Project handle : "+  project.ddr.handle + ")";
                viewVars.breadcrumbs = [];

                if(userIsLoggedIn){
                    viewVars.breadcrumbs.push(
                        {
                            uri : res.locals.baseURI + "/projects/my",
                            title : "My Projects",
                            show_home : true
                        }
                    );
                }
                else
                {
                    viewVars.breadcrumbs.push(
                        {
                            uri : res.locals.baseURI + "/projects",
                            title : "Public Projects",
                            show_home : false
                        }
                    );
                }

                viewVars.breadcrumbs.push(
                    {
                        uri : res.locals.baseURI + "/project/" + req.params.handle,
                        title : decodeURI(req.params.handle)
                    }
                );

                if(showing_history)
                {
                    project.getArchivedVersions(null, null, function(err, archivedResources)
                    {
                        if(!err)
                        {
                            async.map(archivedResources, fetchVersionsInformation, function(err, archivedResourcesWithFullAuthorInformation){
                                if(!err)
                                {

                                    viewVars.versions = archivedResourcesWithFullAuthorInformation;
                                    sendResponse(viewVars, project);
                                }
                                else
                                {
                                    const flash = require('connect-flash');
                                    flash('error', "Unable to fetch information of the change authors. Reported Error: " + archivedResourcesWithFullAuthorInformation);
                                    res.redirect('back');
                                }
                            });
                        }
                        else
                        {
                            var flash = require('connect-flash');
                            flash('error', "Unable to fetch project revisions. Reported Error: " + archivedResources);
                            res.redirect('back');
                        }
                    });
                }
                else
                {
                    project.getPropertiesFromOntologies(
                        Ontology.getPublicOntologiesUris(),
                        function(err, descriptors)
                        {
                            if(!err)
                            {
                                viewVars.descriptors = descriptors;
                                sendResponse(viewVars, project);
                            }
                            else
                            {
                                const flash = require('connect-flash');
                                flash('error', "Unable to fetch descriptors. Reported Error: " + descriptors);
                                res.redirect('back');
                            }
                        }
                    );
                }
            }
            else
            {
                var flash = require('connect-flash');
                flash('error', "Unable to retrieve the project : " + resourceURI + " . " + project);
                res.render('index',
                    {
                        error_messages : ["Project " + resourceURI + " not found."]
                    }
                );
            }
        });
    }
    else
    {
        Folder.findByUri(resourceURI, function(err, containingFolder)
        {
            if(!err && !isNull(containingFolder) && containingFolder instanceof Folder)
            {
                const breadcrumbSections = req.params.filepath.split("/");
                let currentBreadCrumb = res.locals.baseURI + "/project/" + req.params.handle + "/" + breadcrumbSections[1]; //ignore leading "/data" section

                const breadcrumbs = [];

                if(userIsLoggedIn){
                    breadcrumbs.push(
                        {
                            uri : res.locals.baseURI + "/projects/my",
                            title : "My Projects",
                            show_home : true
                        }
                    );
                }
                else
                {
                    breadcrumbs.push(
                        {
                            uri : res.locals.baseURI + "/projects",
                            title : "Public Projects",
                            show_home : false
                        }
                    );
                }


                breadcrumbs.push(
                    {
                        uri : currentBreadCrumb,
                        title : req.params.handle
                    }
                );

                for(let i = 2; i < breadcrumbSections.length; i++)
                {
                    currentBreadCrumb = currentBreadCrumb + "/" + breadcrumbSections[i];
                    breadcrumbs.push(
                        {
                            uri : currentBreadCrumb,
                            title : decodeURI(breadcrumbSections[i])
                        }
                    );
                }

                viewVars.breadcrumbs = breadcrumbs;
                /**
                 * TODO A substituir pela lógica de de permissões de modificação.
                 * @type {boolean}
                 */

                //viewVars.read_only = true;
                viewVars.showing_project_root = false;

                Project.findByHandle(req.params.handle, function(err, project) {
                    if(!err && !isNull(project))
                    {
                        viewVars.project = project;
                        viewVars.title = project.dcterms.title;
                        viewVars.subtitle = "(Project handle : "+  project.ddr.handle + ")";

                        if(showing_history)
                        {
                            containingFolder.getArchivedVersions(null, null, function(err, archivedResources)
                            {
                                if(!err)
                                {
                                    async.map(archivedResources, fetchVersionsInformation, function(err, fullVersions){
                                        if(!err)
                                        {
                                            viewVars.versions = fullVersions;
                                            sendResponse(viewVars, containingFolder);
                                        }
                                        else
                                        {
                                            const flash = require('connect-flash');
                                            flash('error', "Unable to fetch descriptors. Reported Error: " + fullVersions);
                                            res.redirect('back');
                                        }
                                    });
                                }
                                else
                                {
                                    var flash = require('connect-flash');
                                    flash('error', "Unable to fetch project revisions. Reported Error: " + archivedResources);
                                    res.redirect('back');
                                }
                            });
                        }
                        else
                        {
                            containingFolder.getPropertiesFromOntologies(
                                Ontology.getPublicOntologiesUris(),
                                function(err, descriptors)
                                {
                                    if(!err)
                                    {
                                        viewVars.descriptors = descriptors;
                                        sendResponse(viewVars, containingFolder);
                                    }
                                    else
                                    {
                                        const flash = require('connect-flash');
                                        flash('error', "Unable to fetch folder descriptors. Reported Error: " + descriptors);
                                        res.redirect('back');
                                    }
                                }
                            );
                        }
                    }
                    else
                    {
                        var flash = require('connect-flash');
                        flash('error', "Unable to fetch contents of folder");
                        res.redirect('back');
                    }
                });
            }
            else
            {
                var flash = require('connect-flash');
                flash('error', "Unable to fetch project");
                if(!res._headerSent)
                {
                    res.redirect('back');
                }
            }
        });
    }
};

exports.new = function(req, res) {
    let acceptsHTML = req.accepts('html');
    let acceptsJSON = req.accepts('json');

    if(req.originalMethod === "GET")
    {
        if(acceptsJSON && !acceptsHTML){
            res.status(400).json({
                result: "error",
                message : "API Request not valid for this route."
            })
        }
        else
        {
            res.render('projects/new',
                {
                    title: "Create a new project"
                }
            );
        }
    }
    else if (req.originalMethod === "POST")
    {
        acceptsHTML = req.accepts('html');
        acceptsJSON = req.accepts('json');

        if(isNull(req.body.handle) || req.body.handle === "")
        {
            if(acceptsJSON && !acceptsHTML){
                res.status(400).json({
                    result: "error",
                    message : "The project's handle cannot be null or an empty value."
                })
            } else {
                res.render('projects/new',
                    {
                        error_messages: ["The project's handle cannot be null or an empty value."]
                    }
                )
            }
        }
        else if (!isNull(req.body.handle) && !req.body.handle.match(/^[0-9a-z]+$/))
        {
            if(acceptsJSON && !acceptsHTML){
                res.status(400).json({
                    result: "error",
                    message : "Project handle can not include spaces or special characters. It should only include non-capital letters (a to z) and numbers (0 to 9). Valid : project01. Invalid: project 01, project*01, pro@ject, proj%91 "
                })
            } else {
                res.render('projects/new',
                    {
                        error_messages: ["Project handle can not include spaces or special characters. It should only include non-capital letters (a to z) and numbers (0 to 9). Valid : project01. Invalid: project 01, project*01, pro@ject, proj%91 "]
                    }
                )
            }
        }
        else if(!req.body.title || req.body.title === ""){
            if(acceptsJSON && !acceptsHTML){
                res.status(400).json({
                    result: "error",
                    message : "Please insert a title for your project."
                })
            } else {
                res.render('projects/new',
                    {
                        error_messages: ["Please insert a title for your project."]
                    }
                )
            }
        }
        else if(!req.body.description || req.body.description === ""){
            if(acceptsJSON && !acceptsHTML){
                res.status(400).json({
                    result: "error",
                    message : "Please insert a description for your project."
                })
            } else {
                res.render('projects/new',
                    {
                        error_messages: ["Please insert a description for your project."]
                    }
                )
            }
        }
        else if(!req.body.privacy || req.body.privacy === "")
        {
            if(acceptsJSON && !acceptsHTML){
                res.status(400).json({
                    result: "error",
                    message : "Please specify the privacy type for your project."
                })
            } else {
                res.render('projects/new',
                    {
                        error_messages: ["Please specify the privacy type for your project."]
                    }
                )
            }
        }
        else
        {
            Project.findByHandle(req.body.handle, function(err, project){

                if(!err)
                {
                    if((!isNull(project)) && project instanceof Project)
                    {
                        if(acceptsJSON && !acceptsHTML){
                            res.status(400).json({
                                result: "error",
                                message : "A project with handle " + req.body.handle + " already exists. Please choose another one."
                            })
                        } else {
                            res.render('projects/new',
                                {
                                    //title : "Register on Dendro",
                                    error_messages: ["A project with handle " + req.body.handle + " already exists. Please choose another one."]
                                }
                            );
                        }
                    }
                    else
                    {
                        //creator will be the currently logged in user

                        const projectData = {
                            dcterms: {
                                creator: req.user.uri,
                                title: req.body.title,
                                description: req.body.description,
                                publisher: req.body.publisher,
                                language: req.body.language,
                                coverage: req.body.coverage
                            },
                            ddr: {
                                handle: req.body.handle,
                                privacyStatus: req.body.privacy
                            }
                        };

                        Project.createAndInsertFromObject(projectData, function(err, result){
                            if(!err)
                            {
                                req.flash('success', "New project " + projectData.dcterms.title +" with handle "+ projectData.ddr.handle +" created successfully");
                                res.redirect('/projects/my');
                            }
                            else
                            {
                                req.flash('error', "Error creating project " + projectData.dcterms.title +" with handle "+ projectData.ddr.handle +"!");
                                throw err;
                            }

                        });
                    }
                }
                else
                {
                    res.render('projects/new',
                        {
                            error_messages: [project]
                        }
                    );
                }
            });
        }
    }
};

exports.administer = function(req, res) {

    const requestedProjectURI = db.baseURI + "/project/" + req.params.handle;

    const viewVars = {
        title: "Administration Area"
    };

    Project.findByUri(requestedProjectURI, function(err, project)
    {
        if (!err)
        {
            if(!isNull(project))
            {
                viewVars.project = project;

                if (isNull(project.ddr.privacyStatus))
                {
                    project.ddr.privacyStatus = 'private';
                }

                viewVars.privacy = project.ddr.privacyStatus;

                if (req.originalMethod === "POST")
                {
                    let updateProjectMetadata = function(callback)
                    {
                        if (!isNull(req.body.description))
                        {
                            project.dcterms.description = req.body.description;
                        }
                        if (!isNull(req.body.title))
                        {
                            project.dcterms.title = req.body.title;
                        }


                        if (!isNull(req.body.privacy))
                        {
                            viewVars.privacy = req.body.privacy;
                            switch (req.body.privacy)
                            {
                                case "public":
                                    project.ddr.privacyStatus = 'public';
                                    break;
                                case "private":
                                    project.ddr.privacyStatus = 'private';
                                    break;
                                case "metadata_only":
                                    project.ddr.privacyStatus = 'metadata_only';
                                    break;
                            }
                        }

                        return callback(null, project);
                    };

                    let notifyContributor = function(user){

                        const client = nodemailer.createTransport("SMTPS:", {
                            service: 'SendGrid',
                            auth: {
                                user: Config.sendGridUser,
                                pass: Config.sendGridPassword
                            }
                        });

                        const email = {
                            from: 'support@dendro.fe.up.pt',
                            to: user.foaf.mbox,
                            subject: 'Added as contributor for project "' + req.params.handle + '"',
                            text: 'User ' + req.user.uri + ' added you as a contributor for project "' + req.params.handle + '".'
                        };

                        client.sendMail(email, function (err, info) {
                            if (err) {
                                if(Config.logging.log_emails)
                                {
                                    console.log("[NODEMAILER] " + err);
                                }

                                flash('error', "Error sending request to user. Please try again later");
                            }
                            else {
                                console.log("[NODEMAILER] email sent: " + info);
                                flash('success', "Sent request to project's owner");
                            }
                        });
                    };

                    let updateProjectContributors = function(project, callback)
                    {
                        //from http://www.dzone.com/snippets/validate-url-regexp
                        const regexpUri = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
                        const regexpUsername = /(\w+)?/;

                        if (!isNull(req.body.contributors) && req.body.contributors instanceof Array)
                        {
                            async.map(req.body.contributors, function (contributor, callback) {

                                if (regexpUri.test(contributor))
                                {

                                    User.findByUri(contributor, function (err, user) {

                                        if (!err && user && user.foaf.mbox) {
                                            //TODO Check if user already is a contributor so as to not send a notification
                                            notifyContributor(user);
                                            return callback(false, user.uri);
                                        } else {
                                            return callback(true, contributor);
                                        }
                                    });
                                } else if(regexpUsername.test(contributor)){
                                    User.findByUsername(contributor, function (err, user) {

                                        if (!err && user && user.foaf.mbox) {
                                            notifyContributor(user);
                                            return callback(false, user.uri);
                                        } else {
                                            return callback(true, contributor);
                                        }
                                    });
                                } else{
                                    return callback(true, contributor)
                                }

                            }, function(err, contributors){
                               if(!err){
                                    project.dcterms.contributor = contributors;
                                    return callback(null, project);
                                }
                                else
                                {
                                    return callback(err, contributors);
                                }
                            });
                        }else{
                            return callback(null, project);
                        }
                    };

                    let saveProject = function(project, callback)
                    {
                        project.save(function (err, result)
                        {
                            return callback(err, project);
                        });
                    };


                    async.waterfall([
                        updateProjectMetadata,
                        updateProjectContributors,
                        saveProject
                    ], function(err, project){
                        if (!err)
                        {
                            viewVars.project = project;
                            viewVars.success_messages = ["Project " + req.params.handle + " successfully updated."];
                            res.render('projects/administration/administer',
                                viewVars
                            );
                        }
                        else
                        {
                            viewVars.error_messages = [project];
                            res.render('projects/administration/administer',
                                viewVars
                            );
                        }
                    })
                }
                else if (req.originalMethod === "GET")
                {
                    viewVars.project = project;
                    res.render('projects/administration/administer',
                        viewVars
                    );
                }
            }
            else
            {
                viewVars.error_messages = ["Project " + req.params.handle + " does not exist."];
                res.status(401).render('index',
                    viewVars
                );
            }
        }
        else
        {
            viewVars.error_messages = ["Error reported " + project];
            res.render('projects/administration/administer',
                viewVars
            );
        }
    });
};

exports.get_contributors = function(req, res){
    const requestedProjectURI = db.baseURI + "/project/" + req.params.handle;

    Project.findByUri(requestedProjectURI, function(err, project) {
        if (!err) {
            if (!isNull(project)) {
                //from http://www.dzone.com/snippets/validate-url-regexp
                const regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
                let contributorsUri = [];
                if (!isNull(project.dcterms.contributor)){

                    if(project.dcterms.contributor instanceof Array){
                        contributorsUri = project.dcterms.contributor;
                    }else{
                        contributorsUri.push(project.dcterms.contributor);
                    }

                    const contributors = [];
                    async.each(contributorsUri, function (contributor, callback) {

                        if (regexp.test(contributor)) {
                            User.findByUri(contributor, function (err, user) {
                                if (!err && user) {
                                    contributors.push(user);
                                    return callback(null);
                                } else {
                                    return callback(true, contributor);
                                }
                            }, true);
                        } else {
                            return callback(true, contributor)
                        }

                    }, function (err, contributor) {
                        if (!err) {
                            res.json({
                                contributors: contributors
                            });

                        } else {
                            res.status(500).json({
                                message: "Error finding user " + contributor
                            });
                        }
                    });
                }
            }
        }
    });
};

exports.bagit = function(req,res)
{
    const requestedProjectURI = db.baseURI + "/project/" + req.params.handle;

    Project.findByUri(requestedProjectURI, function(err, project){
        if(!err)
        {
            if(!isNull(project) && project instanceof Project)
            {
                project.backup(function(err, baggedContentsZipFileAbsPath, parentFolderPath){
                    if(!err)
                    {
                        if(!isNull(baggedContentsZipFileAbsPath))
                        {
                            const fs = require('fs');
                            const fileStream = fs.createReadStream(baggedContentsZipFileAbsPath);

                            res.on('end', function () {
                                Folder.deleteOnLocalFileSystem(parentFolderPath, function(err, stdout, stderr){
                                    if(err)
                                    {
                                        console.error("Unable to delete " + parentFolderPath);
                                    }
                                    else
                                    {
                                        console.log("Deleted " + parentFolderPath);
                                    }
                                });
                            });

                            fileStream.pipe(res);
                        }
                        else
                        {
                            const error = "There was an error attempting to backup project : " + requestedProjectURI;
                            console.error(error);
                            res.write("500 Error : "+ error +"\n");
                            res.end();
                        }
                    }
                    else
                    {
                        res.status(500).json({
                            result: "error",
                            message : "project " + requestedProjectURI + " was found but it was impossible to delete because of error : " + baggedContentsZipFileAbsPath
                        })
                    }
                });
            }
            else
            {
                res.status(404).json({
                    result : "error",
                    message : "Unable to find project with handle : " + req.params.handle
                });
            }
        }
        else
        {
            res.status(500).json({
                result : "error",
                message : "Invalid project : " + requestedProjectURI + " : " + project
            });
        }
    });
};

exports.delete = function(req,res)
{
    const requestedProjectURI = db.baseURI + "/project/" + req.params.handle;

    let acceptsHTML = req.accepts('html');
    const acceptsJSON = req.accepts('json');

    const viewVars = {
        title: "Administration Area"
    };

    Project.findByUri(requestedProjectURI, function(err, project){
        if(!err)
        {
            if(!isNull(project))
            {
                project.delete(function(err, result){
                    if(!err)
                    {
                        const success_messages = ["Project " + req.params.handle + " successfully marked as deleted"];

                        let acceptsHTML = req.accepts('html');
                        const acceptsJSON = req.accepts('json');

                        if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
                        {
                            res.json(
                                {
                                    result : "ok",
                                    message : success_messages
                                }
                            );
                        }
                        else
                        {
                            res.redirect('/projects/my');
                        }
                    }
                    else
                    {
                        res.status(500).json({
                            result: "error",
                            message : "project " + requestedProjectURI + " was found but it was impossible to delete because of error : " + result
                        })
                    }
                });
            }
            else
            {
                res.status(404).json({
                    result : "error",
                    message : "Unable to find project with handle : " + req.params.handle
                });
            }
        }
        else
        {
            res.status(500).json({
                result : "error",
                message : "Invalid project : " + requestedProjectURI + " : " + project
            });
        }
    });
};

exports.undelete = function(req,res)
{
    const requestedProjectURI = db.baseURI + "/project/" + req.params.handle;

    const viewVars = {
        title: "Administration Area"
    };

    Project.findByUri(requestedProjectURI, function(err, project){
        if(!err)
        {
            if(!isNull(project))
            {
                project.undelete(function(err, result){
                    if(!err)
                    {
                        const success_messages = ["Project " + req.params.handle + " successfully recovered"];

                        let acceptsHTML = req.accepts('html');
                        const acceptsJSON = req.accepts('json');

                        if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
                        {
                            res.json(
                                {
                                    result : "ok",
                                    message : success_messages
                                }
                            );
                        }
                        else
                        {
                            res.redirect('/projects/my');
                        }
                    }
                    else
                    {
                        res.status(500).json({
                            result: "error",
                            message : "project " + requestedProjectURI + " was found but it was impossible to undelete because of error : " + result
                        })
                    }
                });
            }
            else
            {
                res.status(404).json({
                    result : "error",
                    message : "Unable to find project with handle : " + req.params.handle
                });
            }
        }
        else
        {
            res.status(500).json({
                result : "error",
                message : "Invalid project : " + requestedProjectURI + " : " + project
            });
        }
    });
};

exports.recent_changes = function(req, res) {
    const acceptsHTML = req.accepts('html');
    let acceptsJSON = req.accepts('json');

    if(!acceptsJSON && acceptsHTML)
    {
        res.status(400).json({
            result: "error",
            message : "HTML Request not valid for this route."
        });
    }
    else
    {
        const requestedProjectURI = db.baseURI + "/project/" + req.params.handle;


        Project.findByUri(req.params.requestedResource, function(err, project){
            if(!err)
            {
                if(!isNull(project))
                {
                    const offset = parseInt(req.query.offset);
                    const limit = parseInt(req.query.limit);

                    project.getRecentProjectWideChanges(function(err, changes){
                        if(!err)
                        {
                            res.json(changes);
                        }
                        else
                        {
                            res.status(500).json({
                                result : "error",
                                message : "Invalid project : " + requestedProjectURI + " : " + project
                            });
                        }
                    },offset , limit);
                }
                else
                {
                    res.status(404).json({
                        result : "error",
                        message : "Unable to find project with handle : " + req.params.handle
                    });
                }
            }
            else
            {
                res.status(500).json({
                    result : "error",
                    message : "Invalid project : " + requestedProjectURI + " : " + project
                });
            }
        });
    }
};

exports.stats = function(req, res) {

    const requestedProjectURI = db.baseURI + "/project/" + req.params.handle;

    Project.findByUri(requestedProjectURI, function(err, project){
        if(!err)
        {
            const offset = parseInt(req.query.offset);
            const limit = parseInt(req.query.limit);

            async.waterfall([
                    function(callback)
                    {
                        project.getRevisionsCount(function(err, revisionsCount)
                        {
                            if(!err)
                            {
                                return callback(err, revisionsCount)
                            }
                            else
                            {
                                return callback(1,
                                    {
                                        result : "error",
                                        message : "Error calculating calculating number of revisions in project . Error reported : " + JSON.stringify(err) + "."
                                    });
                            }
                        });
                    },
                    function(revisionsCount, callback)
                    {
                        project.getFoldersCount(function(err, foldersCount)
                        {
                            if(!err)
                            {
                                return callback(err, revisionsCount, foldersCount)
                            }
                            else
                            {
                                return callback(1,
                                    {
                                        result : "error",
                                        message : "Error calculating calculating number of folders in project . Error reported : " + JSON.stringify(err) + "."
                                    });
                            }
                        });
                    },
                    function(revisionsCount, foldersCount, callback)
                    {
                        project.getFilesCount(function(err, filesCount)
                        {
                            if(!err)
                            {
                                return callback(err, revisionsCount, foldersCount, filesCount);
                            }
                            else
                            {
                                return callback(1,
                                    {
                                        result : "error",
                                        message : "Error calculating calculating number of files in project . Error reported : " + JSON.stringify(err) + "."
                                    });
                            }
                        });
                    },
                    function(revisionsCount, foldersCount, filesCount, callback)
                    {
                        project.getMembersCount(function(err, membersCount)
                        {
                            if(!err)
                            {
                                return callback(err, revisionsCount, foldersCount, filesCount, membersCount);
                            }
                            else
                            {
                                return callback(1,
                                    {
                                        result : "error",
                                        message : "Error calculating calculating number of members of the project . Error reported : " + JSON.stringify(err) + "."
                                    });
                            }
                        });
                    },
                    function(revisionsCount, foldersCount, filesCount, membersCount, callback)
                    {
                        project.getStorageSize(function(err, storageSize){
                            if(!err)
                            {
                                return callback(err, revisionsCount, foldersCount, filesCount, membersCount, storageSize)
                            }
                            else
                            {
                                return callback(1,
                                    {
                                        result : "error",
                                        message : "Error calculating size of project : " + requestedProjectURI + " . Error reported : " + JSON.stringify(err) + ".",
                                        solution :  "Did you install mongodb via apt-get? YOU NEED MONGODB 10GEN to run this, or it will give errors. Install the latest mongodb by .deb package instead of apt-get."
                                    });
                            }
                        },offset , limit);
                    },
                    function(revisionsCount, foldersCount, filesCount, membersCount, storageSize)
                    {
                        const humanize = require('humanize');

                        res.json({
                            size : humanize.filesize(storageSize),
                            max_size: humanize.filesize(Config.maxProjectSize),
                            percent_full : Math.round((storageSize / Config.maxProjectSize) * 100),
                            members_count : membersCount,
                            folders_count : foldersCount,
                            files_count : filesCount,
                            revisions_count : revisionsCount
                        });
                    }
                ],
                function(err, result)
                {
                    if(err)
                    {
                        res.status(500).json(result);
                    }
                });
        }
        else
        {
            res.status(500).json({
                result : "error",
                message : "Invalid project : " + requestedProjectURI + " : " + project
            });
        }
    });
};

exports.interactions = function(req, res) {
    let username = req.params["username"];
    const currentUser = req.user;
    let acceptsHTML = req.accepts('html');
    const acceptsJSON = req.accepts('json');

    if(!username)
    {
        username = currentUser.uri;
    }

    /**
     * normal users can only access their own information, admins
     * can access information of all users
     */
    if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
    {
        Project.findByHandle(req.params.handle, function(err, project){
            if(!err)
            {
                project.getInteractions(function(err, interactions){
                    if(!err)
                    {
                        res.json(interactions);
                    }
                    else
                    {
                        res.status(500).json({
                            result : "Error",
                            message : "Error retrieving interactions for project " + req.params.handle
                        });
                    }
                });
            }
            else
            {
                res.status(404).json({
                    result : "Error",
                    message : "Unable to find project " + req.params.handle
                });
            }
        });
    }
    else
    {
        const msg = "This method is only accessible via API. Accepts:\"application/json\" header missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        console.log(msg);
        res.status(400).render('',
            {
            }
        );
    }
};

exports.requestAccess = function(req, res){
    let acceptsHTML = req.accepts('html');
    const acceptsJSON = req.accepts('json');

    if(req.originalMethod === "GET")
    {
        if(acceptsJSON && !acceptsHTML){
            res.status(400).json({
                result: "error",
                message : "API Request not valid for this route."
            })
        }
        else
        {
            res.render('projects/request_access',
            {
                handle: req.params.handle
            });
        }
    }
    else if(req.originalMethod === "POST")
    {
        const flash = require('connect-flash');
        console.log(req.user);
        Project.findByHandle(req.params.handle, function (err, project) {
            if (!err && project instanceof Project) {
                const lastSlash = project.dcterms.creator.lastIndexOf("\/");
                const creatorUsername = project.dcterms.creator.substring(lastSlash + 1);

                User.findByUsername(creatorUsername, function (err, user) {
                    if (!err && user instanceof User)
                    {
                        const userMail = user.foaf.mbox;

                        const client = nodemailer.createTransport("SMTP", {
                            service: 'SendGrid',
                            auth: {
                                user: Config.sendGridUser,
                                pass: Config.sendGridPassword
                            }
                        });

                        const email = {
                            from: 'support@dendro.fe.up.pt',
                            to: 'ffjs1993@gmail.com',
                            subject: 'Request for project "' + req.params.handle + '"',
                            text: 'User ' + req.user.uri + ' requested access for project "' + req.params.handle + '".\ ' +
                            'To accept this, please add him as a contributor.'
                        };

                        client.sendMail(email, function(err, info){
                            if(err)
                            {
                                console.log("[NODEMAILER] " + err);
                                flash('error', "Error sending request to user. Please try again later");
                                res.redirect("/");
                            }
                            else
                            {
                                console.log("[NODEMAILER] email sent: " + info);
                                flash('success', "Sent request to project's owner");
                                res.redirect("/");
                            }
                        });
                    }
                    else
                    {
                        flash('error', "Error finding project's owner. Please try again later");
                        res.redirect("/");
                    }
                });
            }
            else
            {
                flash('error', "Error retrieving project. Please try again later");
                res.redirect("/");
            }
        });
    }
};

exports.import = function(req, res) {
    let acceptsHTML = req.accepts('html');
    const acceptsJSON = req.accepts('json');

    if(req.originalMethod === "GET")
    {
        if(acceptsJSON && !acceptsHTML){
            res.status(400).json({
                result: "error",
                message : "API Request not valid for this route."
            })
        }
        else
        {
            const filesize = require('file-size');

            res.render('projects/import/import',
                {
                    title: "Import a project",
                    maxUploadSize : filesize(Config.maxUploadSize).human('jedec'),
                    maxProjectSize : filesize(Config.maxProjectSize).human('jedec')
                }
            );
        }
    }
    else if (req.originalMethod === "POST")
    {
        if(!isNull(req.files) && req.files.file instanceof Object)
        {
            const uploadedFile = req.files.file;
            const path = require('path');

            const tempFilePath = uploadedFile.path;

            if(path.extname(tempFilePath) === ".zip")
            {
                Project.getStructureFromBagItZipFolder(tempFilePath, Config.maxProjectSize, function(err, result, structure){
                    if(!err)
                    {
                        const rebased_structure = JSON.parse(JSON.stringify(structure));
                        Project.rebaseAllUris(rebased_structure, Config.baseUri);

                        res.status(200).json(
                            {
                                "result" : "success",
                                "original_contents" : structure,
                                "modified_contents" : rebased_structure
                            }
                        );
                    }
                    else
                    {
                        const msg = "Error restoring zip file to folder : " + result;
                        console.log(msg);

                        res.status(500).json(
                            {
                                "result" : "error",
                                "message" : msg
                            }
                        );
                    }
                });
            }
            else
            {
                res.status(400).json(
                    {
                        "result" : "error",
                        "message" : "Backup file is not a .zip file"
                    }
                );
            }
        }
        else
        {
            res.status(500).json(
                {
                    "result" : "error",
                    "message" : "invalid request"
                }
            );
        }
    }
};

module.exports = exports;
