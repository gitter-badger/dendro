var Descriptor = require(Config.absPathInSrcFolder("/models/meta/descriptor.js")).Descriptor;
var Post = require('../models/social/post.js').Post;
var MetadataChangePost = require('../models/social/metadataChangePost').MetadataChangePost;
var Like = require('../models/social/like.js').Like;
var Notification = require('../models/notifications/notification.js').Notification;
var Comment = require('../models/social/comment.js').Comment;
var Share = require('../models/social/share.js').Share;
var FileVersion = require('../models/versions/file_version.js').FileVersion;
var Ontology = require('../models/meta/ontology.js').Ontology;
var Project = require('../models/project.js').Project;
var DbConnection = require("../kb/db.js").DbConnection;
var fileVersionController = require("./file_versions");

var _ = require('underscore');

var async = require('async');
var flash = require('connect-flash');
var db = function() { return GLOBAL.db.default; }();
var db_social = function() { return GLOBAL.db.social; }();
var db_notifications = function () { return GLOBAL.db.notifications;}();

var app = require('../app');

exports.numPostsDatabase = function (req, res) {
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');

    if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
    {
        var currentUserUri = req.session.user.uri;
        Project.findByCreatorOrContributor(currentUserUri, function (err, projects) {
            if(!err)
            {
                async.map(projects, function (project, cb1) {
                    cb1(null, project.uri);
                }, function (err, projectsUris) {
                    if(!err)
                    {
                        //numPostsDatabaseAux(projectsUris,function (err, count) {
                        numPostsDatabaseAuxNew(projectsUris,function (err, count) {
                            if(!err)
                            {
                                res.json(count);
                            }
                            else{
                                res.status(500).json({
                                    result : "Error",
                                    message : "Error counting posts. " + JSON.stringify(err)
                                });
                            }
                        });
                    }
                    else
                    {
                        console.error("Error iterating over projects URIs");
                        console.log(err);
                        res.status(500).json({
                            result : "Error",
                            message : "Error counting posts. " + JSON.stringify(err)
                        });
                    }
                })
            }
            else
            {
                res.status(500).json({
                    result : "Error",
                    message : "Error finding user projects"
                });
            }
        });
    }
    else
    {
        var msg = "This method is only accessible via API. Accepts:\"application/json\" header is missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        res.status(400).json({
            result : "Error",
            message : msg
        });
    }
};

exports.all = function(req, res){
    var currentUser = req.session.user;
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');
    var username = currentUser.uri;

    var pingForNewPosts = true;
    var currentPage = req.query.currentPage;
    var index = currentPage == 1? 0 : (currentPage*5) - 5;
    var maxResults = 5;

    if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
    {
        Project.findByCreatorOrContributor(currentUser.uri, function (err, projects) {
            if(!err)
            {
                async.map(projects, function (project, cb1) {
                    cb1(null, project.uri);
                }, function (err, fullProjectsUris) {
                    //getAllPosts(fullProjectsUris,function (err, results) {
                    getAllPostsNew(fullProjectsUris,function (err, results) {
                        if(!err)
                        {
                            res.json(results);
                        }
                        else{
                            res.status(500).json({
                                result : "Error",
                                message : "Error getting posts. " + JSON.stringify(err)
                            });
                        }
                    }, index, maxResults);
                })
            }
            else
            {
                res.status(500).json({
                    result : "Error",
                    message : "Error finding user projects"
                });
            }
        });

        /*if(pingForNewPosts)
        {
            pingNewPosts(currentUser, function (error, newposts) {
                if(error)
                {
                    res.status(500).json({
                        result : "Error",
                        message : "Error pinging posts. " + JSON.stringify(error)
                    });
                }
                else
                {
                    Project.findByCreatorOrContributor(currentUser.uri, function (err, projects) {
                        if(!err)
                        {
                            async.map(projects, function (project, cb1) {
                                cb1(null, project.uri);
                            }, function (err, fullProjectsUris) {
                                //getAllPosts(fullProjectsUris,function (err, results) {
                                getAllPostsNew(fullProjectsUris,function (err, results) {
                                    if(!err)
                                    {
                                        res.json(results);
                                    }
                                    else{
                                        res.status(500).json({
                                            result : "Error",
                                            message : "Error getting posts. " + JSON.stringify(err)
                                        });
                                    }
                                }, index, maxResults);
                            })
                        }
                        else
                        {
                            res.status(500).json({
                                result : "Error",
                                message : "Error finding user projects"
                            });
                        }
                    });
                    /!*
                    getAllPosts(function (err, results) {
                        if(!err)
                        {
                            res.json(results);
                        }
                        else{
                            res.status(500).json({
                                result : "Error",
                                message : "Error getting posts. " + JSON.stringify(err)
                            });
                        }
                    }, index, maxResults);*!/
                }
            });
        }
        else
        {
            Post.all(req, function (err, posts)
            {
                if (!err)
                {
                    async.map(posts, function(post, callback){

                        Post.findByUri(post.uri, function (err, loadedPost) {
                            if(err)
                                callback(err, null);
                            else
                            {
                                callback(null, loadedPost);
                            }

                        //}, Ontology.getAllOntologiesUris(), db_social.graphUri)
                        }, null, db_social.graphUri, null)
                    }, function(err, loadedPosts){
                        if(!err)
                        {
                            loadedPosts.sort(sortPostsByModifiedDate);//sort posts by modified date
                            res.json(loadedPosts);
                        }
                        else
                        {
                            res.status(500).json({
                                result : "Error",
                                message : "Error retrieving post contents. " + JSON.stringify(err)
                            });
                        }
                    });

                }
                else
                {
                    res.status(500).json({
                        result : "Error",
                        message : "Error retrieving post URIs. " + JSON.stringify(err)
                    });
                }
            }, db_social.graphUri, false);
        }*/
    }
    else
    {
        var msg = "This method is only accessible via API. Accepts:\"application/json\" header is missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        res.status(400).json({
            result : "Error",
            message : msg
        });
    }
};

function sortPostsByModifiedDate(postA, postB) {
    var a = new Date(postA.dcterms.modified),
        b = new Date(postB.dcterms.modified);
    return (a.getTime() - b.getTime());
}

//function that pings metadata changes from dendro_graph to build the posts in social_dendro graph
function pingNewPosts(sessionUser, cb) {
    var currentUserUri = sessionUser.uri;
    var numPostsCreated = 0;
    Project.findByCreatorOrContributor(currentUserUri, function(err, projects) {
        if(!err)
        {
            if(projects.length > 0)
            {
                async.map(projects, function (project, cb1) {
                        var socialUpdatedAt = project.dcterms.socialUpdatedAt ? project.dcterms.socialUpdatedAt : '1970-09-21T19:27:46.578Z';
                        project.getRecentProjectWideChangesSocial(function(err, changes){
                            if(!err)
                            {
                                if(changes.length > 0)
                                {
                                    async.map(changes, function(change, callback){
                                            if(change.changes && change.changes[0])// change.changes[0])
                                            {
                                                var newPost = new Post({
                                                    ddr: {
                                                        changeType: change.changes[0].ddr.changeType,
                                                        newValue: change.changes[0].ddr.newValue,
                                                        changedDescriptor: change.changes[0].ddr.changedDescriptor? change.changes[0].ddr.changedDescriptor.label : 'undefined',
                                                        hasContent: change.changes[0].uri,
                                                        numLikes: 0,
                                                        projectUri: project.uri
                                                    },
                                                    dcterms: {
                                                        //creator : currentUserUri,
                                                        creator : change.ddr.versionCreator.uri,
                                                        title: project.dcterms.title
                                                    }
                                                });

                                                newPost.save(function(err, post)
                                                {
                                                    if (!err)
                                                    {
                                                        numPostsCreated++;
                                                        callback(err, post);
                                                    }
                                                    else
                                                    {
                                                        callback(err, post);
                                                    }
                                                }, false, null, null, null, null, db_social.graphUri);
                                            }
                                            else
                                            {
                                                callback(null,null);
                                            }
                                        },
                                        function(err, fullDescriptors)
                                        {
                                            if(!err)
                                            {
                                                var updatedProject = project;
                                                updatedProject.dcterms.socialUpdatedAt = new Date().toISOString();
                                                updateResource(project, updatedProject, db.graphUri, function (error, data) {
                                                    cb1(error, fullDescriptors);
                                                });
                                            }
                                            else
                                            {
                                                var errorMsg = "Error at project changes";
                                                console.log(errorMsg);
                                                cb1(err, errorMsg);
                                            }
                                        });
                                }
                                else
                                {
                                    //no changes detected
                                    var updatedProject = project;
                                    updatedProject.dcterms.socialUpdatedAt = new Date().toISOString();
                                    updateResource(project, updatedProject, db.graphUri, function (error, data) {
                                        cb1(error,data);
                                    });
                                }
                            }
                            else
                            {
                                var errorMsg = "Error getting recent project wide social changes";
                                cb1(err,errorMsg);
                            }
                        },null,null,socialUpdatedAt);
                    },
                    function (err, fullProjects) {
                        //fullProjects.length is fullProjects.length
                        //numPostCreated is numPostsCreated
                        cb(err, fullProjects);
                    });
            }
            else
            {
                cb(null,null);
            }
        }
        else
        {
            var errorMsg = "Error finding projects by creator or contributor";
            callback(err, errorMsg);
        }

    });

}

exports.new = function(req, res){
    /*
     var currentUser = req.session.user;

     if(req.body.new_post_content != null)
     {
     var newPost = new Post({
     ddr: {
     hasContent: req.body.new_post_content
     },
     dcterms: {
     creator : currentUser.uri
     }
     });

     newPost.save(function(err, post)
     {
     if (!err)
     {
     res.json({
     result : "OK",
     message : "Post saved successfully"
     });
     }
     else
     {
     res.status(500).json({
     result: "Error",
     message: "Error saving post. " + JSON.stringify(post)
     });
     }
     }, false, null, null, null, null, db_social.graphUri);
     }
     else
     {
     res.status(400).json({
     result: "Error",
     message: "Error saving post. The request body does not contain the content of the new post (new_body_content field missing)"
     });
     }*/
    var cenas = 'http://127.0.0.1:3001/posts/34240860-82bd-47c9-95fe-5b872451844d';
    getNumLikesForAPost(cenas, function (err, data) {
        /*
         res.json({
         result : "OK",
         message : "Post liked successfully"
         });*/
    });
};


exports.getPost_controller = function (req, res) {
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');

    if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
    {
        var currentUser = req.session.user;
        var postURI = req.body.postID;

        var debugGraph = db_social.graphUri;
        Post.findByUri(req.body.postID, function(err, post)
        {
            if(!err)
            {

                if(!post)
                {
                    var errorMsg = "Invalid post uri";
                    res.status(404).json({
                        result: "Error",
                        message: errorMsg
                    });
                }
                else
                {
                    //app.io.emit('chat message', post);
                    var eventMsg = 'postURI:' + postURI.uri;
                    //var eventMsg = 'postURI:';
                    //app.io.emit(eventMsg, post);
                    res.json(post);
                }
            }
            else
            {
                res.status(500).json({
                    result: "Error",
                    message: "Error getting a post. " + JSON.stringify(post)
                });
            }
        }, null, db_social.graphUri, false, null, null);
    }
    else
    {
        var msg = "This method is only accessible via API. Accepts:\"application/json\" header is missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        res.status(400).json({
            result : "Error",
            message : msg
        });
    }
};

exports.share = function (req, res) {
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');

    if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
    {
        var currentUser = req.session.user;
        var shareMsg = req.body.shareMsg;
        Post.findByUri(req.body.postID, function(err, post)
        {
            if(!err)
            {
                if(!post)
                {
                    var errorMsg = "Invalid post uri";
                    res.status(404).json({
                        result: "Error",
                        message: errorMsg
                    });
                }
                else
                {
                    /*var newShare = new Share({
                        ddr: {
                            userWhoShared : currentUser.uri,
                            postURI: post.uri,
                            shareMsg: shareMsg,
                            projectUri: post.ddr.projectUri
                        },
                        dcterms: {
                            creator: currentUser.uri
                        },
                        rdf: {
                            isShare : true
                        }
                    });*/

                    var newShareData = {
                        ddr: {
                            userWhoShared : currentUser.uri,
                            postURI: post.uri,
                            shareMsg: shareMsg,
                            projectUri: post.ddr.projectUri
                        },
                        dcterms: {
                            creator: currentUser.uri
                        },
                        rdf: {
                            isShare : true
                        }
                    };

                    Share.buildFromInfo(newShareData, function (err, newShare) {
                        var newNotification = new Notification({
                            ddr: {
                                userWhoActed : currentUser.uri,
                                resourceTargetUri: post.uri,
                                actionType: "Share",
                                resourceAuthorUri: post.dcterms.creator,
                                shareURI : newShare.uri
                            },
                            foaf :
                                {
                                    status : "unread"
                                }
                        });

                        newShare.save(function(err, resultShare)
                        {
                            if(!err)
                            {
                                /*
                                 res.json({
                                 result : "OK",
                                 message : "Post shared successfully"
                                 });*/
                                newNotification.save(function (error, resultNotification) {
                                    if(!error)
                                    {
                                        res.json({
                                            result : "OK",
                                            message : "Post shared successfully"
                                        });
                                    }
                                    else
                                    {
                                        res.status(500).json({
                                            result: "Error",
                                            message: "Error saving a notification for a Share " + JSON.stringify(resultNotification)
                                        });
                                    }
                                }, false, null, null, null, null, db_notifications.graphUri);
                            }
                            else
                            {
                                console.error("Error share a post");
                                console.error(err);
                                res.status(500).json({
                                    result: "Error",
                                    message: "Error sharing a post. " + JSON.stringify(resultShare)
                                });
                            }

                        }, false, null, null, null, null, db_social.graphUri);
                    });

                    /*var newShare = new Share({
                        ddr: {
                            userWhoShared : currentUser.uri,
                            fileVersionUri: fileVersion.uri,
                            shareMsg: shareMsg,
                            projectUri: fileVersion.ddr.projectUri,
                            creatorUri: currentUser.uri
                        },
                        rdf: {
                            isShare : true
                        }
                    });*/
                }
            }
            else
            {
                res.status(500).json({
                    result: "Error",
                    message: "Error sharing a post. " + JSON.stringify(post)
                });
            }
        }, null, db_social.graphUri, null);
    }
    else
    {
        var msg = "This method is only accessible via API. Accepts:\"application/json\" header is missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        res.status(400).json({
            result : "Error",
            message : msg
        });
    }
};

exports.getPostComments = function (req, res) {
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');

    if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
    {
        var currentUser = req.session.user;
        var postUri = req.body.postID;

        Post.findByUri(req.body.postID, function(err, post)
        {
            if(!err && post != null)
            {
                getCommentsForAPost(postUri, function (err, comments) {
                    if(err)
                    {
                        res.status(500).json({
                            result: "Error",
                            message: "Error getting comments from a post " + JSON.stringify(comments)
                        });
                    }
                    else
                    {
                        res.json(comments);
                    }
                });
            }
            else
            {
                var errorMsg = "Invalid post uri";
                res.status(404).json({
                    result: "Error",
                    message: errorMsg
                });
            }
        }, null, db_social.graphUri, null);
    }
    else
    {
        var msg = "This method is only accessible via API. Accepts:\"application/json\" header is missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        res.status(400).json({
            result : "Error",
            message : msg
        });
    }
};

exports.comment = function (req, res) {
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');

    if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
    {
        var currentUser = req.session.user;
        var commentMsg = req.body.commentMsg;

        Post.findByUri(req.body.postID, function(err, post)
        {
            if(!err && post != null)
            {
                var newComment = new Comment({
                    ddr: {
                        userWhoCommented : currentUser.uri,
                        postURI: post.uri,
                        commentMsg: commentMsg
                    }
                });

                var newNotification = new Notification({
                    ddr: {
                        userWhoActed : currentUser.uri,
                        resourceTargetUri: post.uri,
                        actionType: "Comment",
                        resourceAuthorUri: post.dcterms.creator
                    },
                    foaf :
                        {
                            status : "unread"
                        }
                });

                newComment.save(function(err, resultComment)
                {
                    if(!err)
                    {
                        /*
                         res.json({
                         result : "OK",
                         message : "Post commented successfully"
                         });*/
                        newNotification.save(function (error, resultNotification) {
                            if(!error)
                            {
                                res.json({
                                    result : "OK",
                                    message : "Post commented successfully"
                                });
                            }
                            else
                            {
                                res.status(500).json({
                                    result: "Error",
                                    message: "Error saving a notification for a Comment " + JSON.stringify(resultNotification)
                                });
                            }
                        }, false, null, null, null, null, db_notifications.graphUri);
                    }
                    else
                    {
                        res.status(500).json({
                            result: "Error",
                            message: "Error Commenting a post. " + JSON.stringify(resultComment)
                        });
                    }

                }, false, null, null, null, null, db_social.graphUri);
            }
            else
            {
                var errorMsg = "Invalid post uri";
                res.status(404).json({
                    result: "Error",
                    message: errorMsg
                });
            }
        }, null, db_social.graphUri, null);
    }
    else
    {
        var msg = "This method is only accessible via API. Accepts:\"application/json\" header is missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        res.status(400).json({
            result : "Error",
            message : msg
        });
    }

    /*Post.findByUri(req.body.postID, function(err, post)
    {
        var newComment = new Comment({
            ddr: {
                userWhoCommented : currentUser.uri,
                postURI: post.uri,
                commentMsg: commentMsg
            }
        });

        var newNotification = new Notification({
            ddr: {
                userWhoActed : currentUser.uri,
                resourceTargetUri: post.uri,
                actionType: "Comment",
                resourceAuthorUri: post.dcterms.creator
            },
            foaf :
            {
                status : "unread"
            }
        });

        newComment.save(function(err, resultComment)
        {
            if(!err)
            {
                /!*
                res.json({
                    result : "OK",
                    message : "Post commented successfully"
                });*!/
                newNotification.save(function (error, resultNotification) {
                    if(!error)
                    {
                        res.json({
                            result : "OK",
                            message : "Post commented successfully"
                        });
                    }
                    else
                    {
                        res.status(500).json({
                            result: "Error",
                            message: "Error saving a notification for a Comment " + JSON.stringify(resultNotification)
                        });
                    }
                }, false, null, null, null, null, db_notifications.graphUri);
            }
            else
            {
                res.status(500).json({
                    result: "Error",
                    message: "Error Commenting a post. " + JSON.stringify(resultComment)
                });
            }

        }, false, null, null, null, null, db_social.graphUri);

    }, null, db_social.graphUri, null);*/
};

exports.checkIfPostIsLikedByUser = function (req, res) {
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');

    if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
    {
        var postID = req.body.postID;
        var currentUser = req.session.user;

        Post.findByUri(postID, function(err, post)
        {
            if(!err && post != null)
            {
                userLikedAPost(post.uri, currentUser.uri, function (err, isLiked) {
                    if(!err)
                        res.json(isLiked);
                    else
                        res.status(500).json({
                            result: "Error",
                            message: "Error getting verifying if a user liked a post in a post. " + JSON.stringify(isLiked)
                        });
                });
            }
            else
            {
                var errorMsg = "Invalid post uri";
                res.status(404).json({
                    result: "Error",
                    message: errorMsg
                });
            }
        }, null, db_social.graphUri, null);
    }
    else
    {
        var msg = "This method is only accessible via API. Accepts:\"application/json\" header is missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        res.status(400).json({
            result : "Error",
            message : msg
        });
    }
};

exports.like = function (req, res) {
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');

    if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
    {
        var currentUser = req.session.user;
        removeOrAdLike(req.body.postID, currentUser.uri, function (err, likeExists) {
            if(!err)
            {
                if(likeExists)
                {
                    //like was removed
                    res.json({
                        result : "OK",
                        message : "Like was removed"
                    });
                }
                else
                {
                    Post.findByUri(req.body.postID, function(err, post)
                    {
                        if(!err && post != null)
                        {
                            var updatedPost = post;
                            var newLike = new Like({
                                ddr: {
                                    userWhoLiked : currentUser.uri,
                                    postURI: post.uri
                                }
                            });

                            //resourceTargetUri -> a post, fileVersion etc
                            //resourceAuthorUri -> the author of the post etc
                            //userWhoActed -> user who commmented/etc
                            //actionType -> comment/like/share
                            //status-> read/unread

                            var newNotification = new Notification({
                                ddr: {
                                    userWhoActed : currentUser.uri,
                                    resourceTargetUri: post.uri,
                                    actionType: "Like",
                                    resourceAuthorUri: post.dcterms.creator
                                },
                                foaf :
                                    {
                                        status : "unread"
                                    }
                            });

                            newLike.save(function(err, resultLike)
                            {
                                if(!err)
                                {
                                    newNotification.save(function (error, resultNotification) {
                                        if(!error)
                                        {
                                            res.json({
                                                result : "OK",
                                                message : "Post liked successfully"
                                            });
                                        }
                                        else
                                        {
                                            res.status(500).json({
                                                result: "Error",
                                                message: "Error saving a notification for a Like " + JSON.stringify(resultNotification)
                                            });
                                        }
                                    }, false, null, null, null, null, db_notifications.graphUri);
                                }
                                else
                                {
                                    res.status(500).json({
                                        result: "Error",
                                        message: "Error Liking a post. " + JSON.stringify(resultLike)
                                    });
                                }

                            }, false, null, null, null, null, db_social.graphUri);
                        }
                        else
                        {
                            var errorMsg = "Invalid post uri";
                            res.status(404).json({
                                result: "Error",
                                message: errorMsg
                            });
                        }
                    }, null, db_social.graphUri, null);
                }
            }
        });
    }
    else
    {
        var msg = "This method is only accessible via API. Accepts:\"application/json\" header is missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        res.status(400).json({
            result : "Error",
            message : msg
        });
    }
};

/*var updateResource = function(currentResource, newResource, graphUri, cb)
{
    var descriptors = newResource.getDescriptors();

    db.connection.replaceDescriptorsOfSubject(
        currentResource.uri,
        descriptors,
        graphUri,
        function(err, result)
        {
            cb(err, result);
        }
    );
};*/


var numPostsDatabaseAuxNew = function (projectUrisArray, callback) {
    /*WITH <http://127.0.0.1:3001/social_dendro>
     SELECT (COUNT(DISTINCT ?postURI) AS ?count)
     WHERE {
     ?postURI rdf:type ddr:Post.
     }*/
    if(projectUrisArray && projectUrisArray.length > 0)
    {
        async.map(projectUrisArray, function (uri, cb1) {
            cb1(null, '<'+uri+ '>');
        }, function (err, fullProjectsUris) {
            var projectsUris = fullProjectsUris.join(" ");
            var query =
                "WITH [0] \n" +
                "SELECT (COUNT(DISTINCT ?uri) AS ?count) \n" +
                "WHERE { \n" +
                "VALUES ?project { \n" +
                projectsUris +
                "} \n" +
                "VALUES ?postTypes { \n" +
                "ddr:Post" + " ddr:Share" + " ddr:MetadataChangePost" +
                "} \n" +
                "?uri rdf:type ?postTypes. \n" +
                "?uri ddr:projectUri ?project. \n" +
                "} \n ";

            db.connection.execute(query,
                DbConnection.pushLimitsArguments([
                    {
                        type : DbConnection.resourceNoEscape,
                        value: db_social.graphUri
                    }
                ]),
                function(err, results) {
                    if(!err)
                    {
                        callback(err,results[0].count);
                    }
                    else
                    {
                        callback(true, "Error fetching numPosts in numPostsDatabaseAux");
                    }
                });
        });
    }
    else
    {
        //User has no projects
        var results = 0;
        callback(null, results);
    }
};


var numPostsDatabaseAux = function (projectUrisArray, callback) {
    /*WITH <http://127.0.0.1:3001/social_dendro>
    SELECT (COUNT(DISTINCT ?postURI) AS ?count)
    WHERE {
        ?postURI rdf:type ddr:Post.
    }*/
    if(projectUrisArray && projectUrisArray.length > 0)
    {
        async.map(projectUrisArray, function (uri, cb1) {
            cb1(null, '<'+uri+ '>');
        }, function (err, fullProjectsUris) {
            var projectsUris = fullProjectsUris.join(" ");
            var query =
                "WITH [0] \n" +
                "SELECT (COUNT(DISTINCT ?uri) AS ?count) \n" +
                "WHERE { \n" +
                "VALUES ?project { \n" +
                projectsUris +
                "} \n" +
                "?uri rdf:type ddr:Post. \n" +
                "?uri ddr:projectUri ?project. \n" +
                "} \n ";

            db.connection.execute(query,
                DbConnection.pushLimitsArguments([
                    {
                        type : DbConnection.resourceNoEscape,
                        value: db_social.graphUri
                    }
                ]),
                function(err, results) {
                    if(!err)
                    {
                        callback(err,results[0].count);
                    }
                    else
                    {
                        callback(true, "Error fetching numPosts in numPostsDatabaseAux");
                    }
                });
        });
    }
    else
    {
        //User has no projects
        var results = 0;
        callback(null, results);
    }
};

var updateResource = function(currentResource, newResource, graphUri, cb)
{
    var newDescriptors= newResource.getDescriptors();

    currentResource.replaceDescriptorsInTripleStore(
        newDescriptors,
        graphUri,
        function(err, result)
        {
            cb(err, result);
        }
    );
};

var removeLike = function (likeID, userUri, cb) {
    var self = this;

    var query =
        "WITH [0] \n" +
        //"DELETE {?likeURI ?p ?v}\n" +
        "DELETE {[1] ?p ?v}\n" +
        //"FROM [0] \n" +
        "WHERE { \n" +
        "[1] ?p ?v \n" +
        //"?likeURI ddr:postURI ?postID \n" +
        //"?likeURI rdf:type ddr:Like. \n" +
        //"?likeURI ddr:postURI [1]. \n" +
        //"?likeURI ddr:userWhoLiked [2]. \n" +
        "} \n";

    db.connection.execute(query,
        DbConnection.pushLimitsArguments([
            {
                type : DbConnection.resourceNoEscape,
                value: db_social.graphUri
            },
            {
                type : DbConnection.resource,
                value : likeID
            }
        ]),
        function(err, results) {
            if(!err)
            {
                var likeExists = false;
                if(results.length > 0)
                {
                    likeExists = true;
                }
                cb(false, likeExists);
            }
            else
            {
                cb(true, "Error fetching children of project root folder");
            }
        });
};

var removeOrAdLike = function (postID, userUri, cb) {
    var self = this;

    var query =
        "SELECT ?likeURI \n" +
        "FROM [0] \n" +
        "WHERE { \n" +
        "?likeURI rdf:type ddr:Like. \n" +
        "?likeURI ddr:postURI [1]. \n" +
        "?likeURI ddr:userWhoLiked [2]. \n" +
        "} \n";

    db.connection.execute(query,
        DbConnection.pushLimitsArguments([
            {
                type : DbConnection.resourceNoEscape,
                value: db_social.graphUri
            },
            {
                type : DbConnection.resource,
                value : postID
            },
            {
                type : DbConnection.resource,
                value : userUri
            }
        ]),
        function(err, results) {
            if(!err)
            {
                var likeExists = false;
                if(results.length > 0)
                {
                    removeLike(results[0].likeURI, userUri, function (err, data) {
                        likeExists = true;
                        cb(err, likeExists);
                    });
                }
                else
                    cb(err, likeExists);
            }
            else
            {
                cb(true, "Error fetching children of project root folder");
            }
        });
};


var getCommentsForAPost = function (postID, cb) {
    var self = this;

    var query =
        "SELECT ?commentURI \n" +
        "FROM [0] \n" +
        "WHERE { \n" +
        "?commentURI rdf:type ddr:Comment. \n" +
        "?commentURI ddr:postURI [1]. \n" +
        "?commentURI dcterms:modified ?date. \n " +
        "} \n" +
        "ORDER BY ASC(?date) \n";

    db.connection.execute(query,
        DbConnection.pushLimitsArguments([
            {
                type : DbConnection.resourceNoEscape,
                value: db_social.graphUri
            },
            {
                type : DbConnection.resource,
                value : postID
            }
        ]),
        function(err, results) {
            if(!err)
            {
                async.map(results, function(commentUri, callback){
                    Comment.findByUri(commentUri.commentURI, function(err, comment)
                    {
                        callback(false,comment);
                    //}, Ontology.getAllOntologiesUris(), db_social.graphUri);
                    }, null, db_social.graphUri, null);
                }, function (err, comments) {
                    cb(false, comments);
                });
            }
            else
            {
                cb(true, "Error fetching children of project root folder");
            }
        });
};

var getSharesForAPost = function (postID, cb) {
    var self = this;

    var query =
        "SELECT ?shareURI \n" +
        "FROM [0] \n" +
        "WHERE { \n" +
        "?shareURI rdf:type ddr:Share. \n" +
        "?shareURI ddr:postURI [1]. \n" +
        "} \n";

    db.connection.execute(query,
        DbConnection.pushLimitsArguments([
            {
                type : DbConnection.resourceNoEscape,
                value: db_social.graphUri
            },
            {
                type : DbConnection.resource,
                value : postID
            }
        ]),
        function(err, results) {
            if(!err)
            {
                async.map(results, function(shareObject, callback){
                    Share.findByUri(shareObject.shareURI, function(err, share)
                    {
                        callback(false,share);
                    //}, Ontology.getAllOntologiesUris(), db_social.graphUri);
                    }, null, db_social.graphUri, null);
                }, function (err, shares) {
                    cb(false, shares);
                });
            }
            else
            {
                cb(true, "Error shares for a post");
            }
        });
};

function saveCurrentUserInRedis(req, res) {
    var redis = require("redis");
    client = redis.createClient();

}

exports.getPostShares = function (req, res) {
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');

    if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
    {
        var currentUser = req.session.user;
        var postUri = req.body.postID;

        Post.findByUri(postUri, function(err, post)
        {
            if(!err && post != null)
            {
                getSharesForAPost(postUri, function (err, shares) {
                    if(err)
                    {
                        res.status(500).json({
                            result: "Error",
                            message: "Error getting shares from a post " + JSON.stringify(shares)
                        });
                    }
                    else
                    {
                        res.json(shares);
                    }
                });
            }
            else
            {
                var errorMsg = "Invalid post uri";
                res.status(404).json({
                    result: "Error",
                    message: errorMsg
                });
            }
        }, null, db_social.graphUri, null);
    }
    else
    {
        var msg = "This method is only accessible via API. Accepts:\"application/json\" header is missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        res.status(400).json({
            result : "Error",
            message : msg
        });
    }
};

exports.postLikesInfo = function (req, res) {
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');

    if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
    {
        var currentUser = req.session.user;
        var postURI = req.body.postURI;
        var resultInfo;

        Post.findByUri(postURI, function(err, post)
        {
            if(!err && post != null)
            {
                getNumLikesForAPost(post.uri, function (err, likesArray) {
                    if(!err)
                    {
                        if(likesArray.length)
                        {
                            resultInfo = {
                                postURI: postURI, numLikes : likesArray.length, usersWhoLiked : _.pluck(likesArray, 'userURI')
                            };
                        }
                        else
                        {
                            resultInfo = {
                                postURI: postURI, numLikes : 0, usersWhoLiked : 'undefined'
                            };
                        }
                        res.json(resultInfo);
                    }
                    else
                    {
                        res.status(500).json({
                            result: "Error",
                            message: "Error getting likesInfo from a post " + JSON.stringify(err)
                        });
                    }

                });
            }
            else
            {
                var errorMsg = "Invalid post uri";
                res.status(404).json({
                    result: "Error",
                    message: errorMsg
                });
            }
        }, null, db_social.graphUri, null);
    }
    else
    {
        var msg = "This method is only accessible via API. Accepts:\"application/json\" header is missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        res.status(400).json({
            result : "Error",
            message : msg
        });
    }
};

var userLikedAPost = function(postID, userUri, cb )
{
    var self = this;

    var query =
        "SELECT ?likeURI \n" +
        "FROM [0] \n" +
        "WHERE { \n" +
        "?likeURI rdf:type ddr:Like. \n" +
        "?likeURI ddr:postURI [1]. \n" +
        "?likeURI ddr:userWhoLiked [2]. \n" +
        "} \n";

    db.connection.execute(query,
        DbConnection.pushLimitsArguments([
            {
                type : DbConnection.resourceNoEscape,
                value: db_social.graphUri
            },
            {
                type : DbConnection.resource,
                value : postID
            },
            {
                type : DbConnection.resource,
                value : userUri
            }
        ]),
        function(err, results) {
            if(!err)
            {
                if(results.length > 0)
                    cb(err, true);
                else
                    cb(err, false);
            }
            else
            {
                cb(true, "Error checking if a post is liked by a user");
            }
        });
};

var getNumLikesForAPost = function(postID, cb)
{
    var self = this;

    var query =
        "SELECT ?likeURI ?userURI \n" +
        "FROM [0] \n" +
        "WHERE { \n" +
        "?likeURI rdf:type ddr:Like. \n" +
        "?likeURI ddr:postURI [1]. \n" +
        "?likeURI ddr:userWhoLiked ?userURI . \n" +
        "} \n";

    db.connection.execute(query,
        DbConnection.pushLimitsArguments([
            {
                type : DbConnection.resourceNoEscape,
                value: db_social.graphUri
            },
            {
                type : DbConnection.resource,
                value : postID
            }
        ]),
        function(err, results) {
            if(!err)
            {
                cb(false, results);
            }
            else
            {
                cb(true, "Error fetching children of project root folder");
            }
        });
};


/**
 * Gets all the posts ordered by modified date and using pagination
 * @param callback the function callback
 * @param startingResultPosition the starting position to start the query
 * @param maxResults the limit for the query
 */
var getAllPostsNew = function (projectUrisArray, callback, startingResultPosition, maxResults) {
    //based on getRecentProjectWideChangesSocial
    //TODO ALTERAR ESTA FUNCAO PARA TER TODOS OS TIPOS DE SHARES (E TB FILEVERSIOS?????)
    var self = this;

    if(projectUrisArray && projectUrisArray.length > 0)
    {
        async.map(projectUrisArray, function (uri, cb1) {
            cb1(null, '<'+uri+ '>');
        }, function (err, fullProjects) {
            var projectsUris = fullProjects.join(" ");
            var query =
                "WITH [0] \n" +
                "SELECT DISTINCT ?uri \n" +
                "WHERE { \n" +
                "VALUES ?project { \n" +
                projectsUris +
                "} \n" +
                "VALUES ?postTypes { \n" +
                "ddr:Post" + " ddr:Share" + " ddr:MetadataChangePost" +
                "} \n" +
                "?uri dcterms:modified ?date. \n" +
                "?uri rdf:type ?postTypes. \n" +
                "?uri ddr:projectUri ?project. \n" +
                "} \n "+
                "ORDER BY DESC(?date) \n";

            query = DbConnection.addLimitsClauses(query, startingResultPosition, maxResults);

            db.connection.execute(query,
                DbConnection.pushLimitsArguments([
                    {
                        type : DbConnection.resourceNoEscape,
                        value: db_social.graphUri
                    }
                ]),
                function(err, results) {
                    if(!err)
                    {
                        callback(err,results);
                    }
                    else
                    {
                        callback(true, "Error fetching posts in getAllPosts");
                    }
                });
        });
    }
    else
    {
        //User has no projects
        var results = [];
        callback(null, results);
    }
};

/**
 * Gets all the posts ordered by modified date and using pagination
 * @param callback the function callback
 * @param startingResultPosition the starting position to start the query
 * @param maxResults the limit for the query
 */
var getAllPosts = function (projectUrisArray, callback, startingResultPosition, maxResults) {
    //based on getRecentProjectWideChangesSocial
    //TODO ALTERAR ESTA FUNCAO PARA TER TODOS OS TIPOS DE SHARES (E TB FILEVERSIOS?????)
    var self = this;

    if(projectUrisArray && projectUrisArray.length > 0)
    {
        async.map(projectUrisArray, function (uri, cb1) {
            cb1(null, '<'+uri+ '>');
        }, function (err, fullProjects) {
            var projectsUris = fullProjects.join(" ");
            var query =
                "WITH [0] \n" +
                "SELECT DISTINCT ?uri \n" +
                "WHERE { \n" +
                "VALUES ?project { \n" +
                projectsUris +
                "} \n" +
                "?uri dcterms:modified ?date. \n" +
                "?uri rdf:type ddr:Post. \n" +
                "?uri ddr:projectUri ?project. \n" +
                "} \n "+
                "ORDER BY DESC(?date) \n";

            query = DbConnection.addLimitsClauses(query, startingResultPosition, maxResults);

            db.connection.execute(query,
                DbConnection.pushLimitsArguments([
                    {
                        type : DbConnection.resourceNoEscape,
                        value: db_social.graphUri
                    }
                ]),
                function(err, results) {
                    if(!err)
                    {
                        callback(err,results);
                    }
                    else
                    {
                        callback(true, "Error fetching posts in getAllPosts");
                    }
                });
        });
    }
    else
    {
        //User has no projects
        var results = [];
        callback(null, results);
    }
};

exports.post = function (req, res) {
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');
    var currentUser = req.session.user;
    var postUri = "http://"+Config.host + req.url;

    var getCommentsForAPost = function (post, cb) {
        post.getComments(function (err, commentsData) {
            cb(err, commentsData);
        });
    };

    var getLikesForAPost = function (post, cb) {
        post.getLikes(function (err, likesData) {
            cb(err, likesData);
        });
    };

    var getSharesForAPost = function (post, cb) {
        post.getShares(function (err, sharesData) {
            cb(err, sharesData);
        });
    };

    var getChangesFromMetadataChangePost = function (metadataChangePost, cb) {
        metadataChangePost.getChangesFromMetadataChangePost(function (err, changesData) {
            cb(err, changesData);
        });
    };

    //uri, callback, allowedGraphsArray, customGraphUri, skipCache, descriptorTypesToRemove, descriptorTypesToExemptFromRemoval
    //TODO VERIFICAR AQUI QUE TIPO DE POST É e construir as 3 changes etc
    Post.findByUri(postUri, function(err, post)
    {
        if(!err && post != null)
        {
            if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
            {
                //TODO ARRANJAR MANEIRA AQUI para correr diferentes funções dependendo do type do post(mandar changes etc)
                //EXEMPLO
                /*async.parallel(
                    [
                        getUserCount, getAllUsers
                    ], function(err, results)
                    {*/
                /*async.parallel([
                        function(callback) {
                            getCommentsForAPost(post.uri, function (err, commentsData) {
                                callback(err, commentsData);
                            });
                        },
                        function(callback) {
                            getLikesForAPost(post.uri, function (err, likesData) {
                                callback(err, likesData);
                            });
                        },
                        function (callback) {
                            getSharesForAPost(post.uri, function (err, sharesData) {
                                callback(err, sharesData);
                            });
                        }
                    ],
                    // optional callback
                    function(err, results) {
                        post.commentsContent = results[0];
                        post.likesContent = results[1];
                        post.sharesContent = results[2];
                        res.json(post);
                    });*/

                async.series([
                        function(callback) {
                            getCommentsForAPost(post, function (err, commentsData) {
                                post.commentsContent = commentsData;
                                callback(err);
                            });
                        },
                        function(callback) {
                            getLikesForAPost(post, function (err, likesData) {
                                post.likesContent = likesData;
                                callback(err);
                            });
                        },
                        function (callback) {
                            getSharesForAPost(post, function (err, sharesData) {
                                post.sharesContent = sharesData;
                                callback(err);
                            });
                        },
                        function (callback) {
                            //TODO HOW TO ACCESS THE FULL TYPE
                            if(post.rdf.type === "http://dendro.fe.up.pt/ontology/0.1/MetadataChangePost")
                            {
                                MetadataChangePost.findByUri(post.uri, function (err, metadataChangePost) {
                                    if(!err)
                                    {
                                        getChangesFromMetadataChangePost(metadataChangePost, function (err, changesInfo) {
                                            //[editChanges, addChanges, deleteChanges]
                                            post.changesInfo = changesInfo;
                                            callback(err);
                                        });
                                    }
                                    else
                                    {
                                        console.error("Error getting a metadataChangePost");
                                        console.error(err);
                                        callback(err);
                                    }
                                }, null, db_social.graphUri, false, null, null);
                            }
                            else
                            {
                                cb(null);
                            }
                        }
                        //TODO METER AQUI UM IF NO caso de ser METADATACHANGEPOST para correr a função buildChanges que mete as changes no post
                    ],
                    // optional callback
                    function(err, results) {
                        /*post.commentsContent = results[0];
                        post.likesContent = results[1];
                        post.sharesContent = results[2];*/
                        res.json(post);
                    });
            }
            else
            {
                res.render('social/showPost',
                    {
                        postUri : postUri
                    }
                );
            }
        }
        else
        {
            if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
            {
                var errorMsg = "Invalid post uri";
                res.status(404).json({
                    result: "Error",
                    message: errorMsg
                });
            }
            else
            {
                 flash('error', "Unable to retrieve the post : " + postUri);
                 res.render('index',
                 {
                     error_messages : ["Post " + postUri + " not found."]
                 });
            }
        }
    }, null, db_social.graphUri, false, null, null);
};

exports.getShare = function (req, res) {
    var acceptsHTML = req.accepts('html');
    var acceptsJSON = req.accepts('json');

    var currentUser = req.session.user;
    var shareUri = "http://"+req.headers.host + req.url;
    var fileVersionType = "http://dendro.fe.up.pt/ontology/0.1/FileVersion";
    var shareOfAPost;

    Share.findByUri(shareUri, function(err, share)
    {
        if(!err && share != null)
        {
            shareOfAPost = share.ddr.fileVersionUri == null ? true : false;
            if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
            {
                if(shareOfAPost)
                {
                    async.parallel([
                            function(callback) {
                                getCommentsForAPost(share.uri, function (err, commentsData) {
                                    callback(err, commentsData);
                                });
                            },
                            function(callback) {
                                getLikesForAPost(share.uri, function (err, likesData) {
                                    callback(err, likesData);
                                });
                            },
                            function (callback) {
                                getSharesForAPost(share.uri, function (err, sharesData) {
                                    callback(err, sharesData);
                                });
                            }
                        ],
                        // optional callback
                        function(err, results) {
                            share.commentsContent = results[0];
                            share.likesContent = results[1];
                            share.sharesContent = results[2];
                            res.json(share);
                        });
                }
                else
                {
                    //Is a share of a fileVersion
                    FileVersion.findByUri(share.uri, function(err, fileVersion)
                    {
                        if(!err && fileVersion != null)
                        {
                            async.parallel([
                                    function(callback) {
                                        fileVersion.getComments(function (err, commentsData) {
                                            callback(err, commentsData);
                                        });
                                        /*getCommentsForAPost(share.uri, function (err, commentsData) {
                                         callback(err, commentsData);
                                         });*/
                                    },
                                    function(callback) {
                                        fileVersion.getLikes(function (err, likesData) {
                                            callback(err, likesData);
                                        });
                                        /*getLikesForAPost(share.uri, function (err, likesData) {
                                         callback(err, likesData);
                                         });*/
                                    },
                                    function (callback) {
                                        fileVersion.getShares(function (err, sharesData) {
                                            callback(err, sharesData);
                                        });
                                        /*getSharesForAPost(share.uri, function (err, sharesData) {
                                         callback(err, sharesData);
                                         });*/
                                    }
                                ],
                                // optional callback
                                function(err, results) {
                                    fileVersion.commentsContent = results[0];
                                    fileVersion.likesContent = results[1];
                                    fileVersion.sharesContent = results[2];
                                    res.json(fileVersion);
                                });
                        }
                        else
                        {
                            var errorMsg = "Error looking for a shared fileVersion with uri " + share.uri;
                            res.status(404).json({
                                result: "Error",
                                message: errorMsg
                            });
                        }
                    }, null, db_social.graphUri, null);
                }
            }
            else
            {
                //TODO AQUI UM IF verificar se é um share de um post ou fileversion
                if(shareOfAPost)
                {
                    res.render('social/showShare',
                        {
                            shareUri : shareUri
                        }
                    );
                }
                else
                {
                    res.render('social/showShareFileVersion',
                        {
                            shareUri : shareUri
                        }
                    );
                }
            }
        }
        else
        {
            if(acceptsJSON && !acceptsHTML)  //will be null if the client does not accept html
            {
                var errorMsg = "Invalid share uri";
                res.status(404).json({
                    result: "Error",
                    message: errorMsg
                });
            }
            else
            {
                flash('error', "Unable to retrieve the share : " + shareUri);
                res.render('index',
                    {
                        error_messages : ["Share " + shareUri + " not found."]
                    });
            }
        }
    }, null, db_social.graphUri, null);

    return;
    /*
    if(acceptsHTML && !acceptsJSON)  //will be null if the client does not accept html
    {*/


        //TODO find the share in database
        //TODO see if it has ddr:postURI or ddr:fileVersionUri
        //TODO redirect to social/showPost or social/showFileVersion

        var query =
            "WITH [0] \n" +
            "SELECT ?type \n" +
            "WHERE { \n" +
            "[1] ddr:fileVersionUri ?fileVersionUri \n" +
            "}";

        query = DbConnection.addLimitsClauses(query, null, null);

        db.connection.execute(query,
            DbConnection.pushLimitsArguments([
                {
                    type : DbConnection.resourceNoEscape,
                    value: db_social.graphUri
                },
                {
                    type : DbConnection.resourceNoEscape,
                    value: shareUri
                }
            ]),
            function(err, results) {
                if(!err)
                {
                    //var types =_.pluck(results, 'type');

                    /*if(types.indexOf(fileVersionType) > -1)
                     {
                     res.render('social/showFileVersion',
                     {
                     fileVersionUri : shareUri
                     }
                     );
                     }
                     else
                     {
                     res.render('social/showPost',
                     {
                     postUri : shareUri
                     }
                     );
                     }*/
                    if(results.length > 0)
                    {
                        res.render('social/showFileVersion',
                            {
                                fileVersionUri : shareUri
                            }
                        );
                    }
                    else
                    {
                        res.render('social/showPost',
                            {
                                postUri : shareUri
                            }
                        );
                    }
                }
                else
                {
                    var errorMsg = "Error fetching share";
                    res.send(500, errorMsg);
                }
            });
   /* }
    else
    {
        var msg = "This method is only accessible via HTML. Accept:\"text/html\" header is missing or is not the only Accept type";
        req.flash('error', "Invalid Request");
        res.status(400).json({
            result : "Error",
            message : msg
        });
    }*/
};


//AUX FUNCTIONS

//Já existe o getCommentsForAPost e o getSharesForAPost
var getLikesForAPost = function (postUri, callback) {
    let resultInfo;
    Post.findByUri(postUri, function(err, post)
    {
        if(!err && post != null)
        {
            getNumLikesForAPost(post.uri, function (err, likesArray) {
                if(!err)
                {
                    if(likesArray.length)
                    {
                        resultInfo = {
                            postURI: post.uri, numLikes : likesArray.length, usersWhoLiked : _.pluck(likesArray, 'userURI')
                        };
                    }
                    else
                    {
                        resultInfo = {
                            postURI: post.uri, numLikes : 0, usersWhoLiked : 'undefined'
                        };
                    }
                    callback(null, resultInfo);
                }
                else
                {
                    console.error("Error getting likesInfo from a post");
                    console.error(err);
                    callback(true, "Error getting likesInfo from a post");
                }

            });
        }
        else
        {
            var errorMsg = "Invalid post uri";
            console.error(err);
            console.error(errorMsg);
        }
    }, null, db_social.graphUri, null);
};
