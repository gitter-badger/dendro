const Config = function () {
    return GLOBAL.Config;
}();

const isNull = require(Config.absPathInSrcFolder("/utils/null.js")).isNull;
const DryadLoader = require(Config.absPathInSrcFolder("/kb/loaders/dryad/dryad_loader.js")).DryadLoader;
const IndexConnection = require(Config.absPathInSrcFolder("/kb/index.js")).IndexConnection;
const Resource = require(Config.absPathInSrcFolder("/models/resource.js")).Resource;

const db = function () {
    return GLOBAL.db.default;
}();

module.exports.home = function(req, res) {
    res.render('admin/home',
        {
            title: 'List of available administration operations'
        }
    );
};

module.exports.reload = function(req, res)
{
    const graphNames = req.query.graphs;
    const graphsToDelete = req.query.graphs_to_delete;
    const async = require("async");

    const renderResponse = function (err, messages) {
        if (!err) {
            const util = require('util');
            //noinspection ES6ConvertVarToLetConst
            var messages = "All resources successfully loaded in graph(s) : ";

            for (let i = 0; i < graphNames.length; i++) {
                messages = messages + " " + graphNames[i];

                if (i < graphNames.length - 1) {
                    messages = messages + ", ";
                }
            }

            res.render('admin/home',
                {
                    title: 'List of available administration operations',
                    info_messages: [messages]
                }
            );
        }
        else {
            res.render('admin/home',
                {
                    title: 'List of available administration operations',
                    error_messages: messages
                }
            );
        }

    };

    const deleteGraph = function (graphUri, callback) {
        db.deleteGraph(graphUri, callback);
    };


    for(let graph in graphNames)
    {
        /*if(graphNames[i] == "dbpedia")
        {
            if(graphsToDelete[i])
            {
                async.waterfall(
                    [
                        function(callback)
                        {
                            deleteGraph("http://dbpedia.org",
                                function(err, resultOrErrorMessage)
                                {
                                    return callback(err, [resultOrErrorMessage]);
                                });
                        },
                        function(callback, result)
                        {
                            var path = require('path');
                            var DBPediaLoader = require("../kb/loaders/dbpedia/loader").DBPediaLoader;
                            var dbpediaLoader = new DBPediaLoader(db);
                            dbpediaLoader.load_dbpedia(renderResponse);
                        }
                    ],
                    renderResponse
                );
            }
            else
            {
                var path = require('path');
                var DBPediaLoader = require("../kb/loaders/dbpedia/loader").DBPediaLoader;
                var dbpediaLoader = new DBPediaLoader(db);
                dbpediaLoader.load_dbpedia(renderResponse);
            }
        }*/
        if(graph === "dryad")
        {
            const dryadLoader = new DryadLoader();
            dryadLoader.loadFromDownloadedFiles(req.index);
        }
    }

    res.render('admin/home',
        {
            title: 'List of available administration operations',
            info_messages : [JSON.stringify(graphNames) + " loading in the background"]
        }
    );
};

module.exports.reindex = function(req, res)
{
    const self = this;

    const indexConnection = req.index;
    const graphsToBeIndexed = req.query.graphs;
    const graphsToDelete = req.query.graphs_to_delete;

    const async = require('async');

    for(graph in graphsToBeIndexed)
    {
        if(graphsToBeIndexed.hasOwnProperty(graph))
        {
            const graphShortName = graphsToBeIndexed[graph];
            const deleteTheIndex = !isNull(graphsToDelete[graph]);

            rebuildIndex(indexConnection, graphShortName, deleteTheIndex, function(err, result)
            {
                if(err)
                {
                    res.render('admin/home',
                        {
                            title: 'List of available administration operations',
                            error_messages : [result]
                        }
                    );
                }
                else
                {
                    res.render('admin/home',
                        {
                            title: 'List of available administration operations',
                            info_messages : ["Resources successfully indexed for graphs " + JSON.stringify(graphsToBeIndexed)]
                        }
                    );
                }
            });
        }
    }
};

var rebuildIndex = function(indexConnection, graphShortName, deleteBeforeReindexing, callback)
{
    const self = this;
    let index = null;

    for(let graph in IndexConnection.indexes)
    {
        if(IndexConnection.indexes.hasOwnProperty(graph) && IndexConnection.indexes[graph].short_name === graphShortName)
        {
            index = IndexConnection.indexes[graph];
            break;
        }
    }

    if(!isNull(index))
    {
        const async = require('async');

        async.waterfall([
            function(callback) //delete current index if requested
            {
                indexConnection.create_new_index(1, 1, deleteBeforeReindexing, function(err,result)
                {
                    if(!err && result)
                    {
                        console.log("Index "+indexConnection.index.short_name+" recreated .");
                        return callback(null);

                    }
                    else
                    {
                        console.log("Error recreating index "+indexConnection.index.short_name+" . " + result);
                        return callback(1); //delete success, move on
                    }
                });
            },
            function(callback) //select all elements in the knowledge base
            {
                Resource.all(null, function(err, resources) {
                    if(!err)
                    {
                        for(let i = 0; i < resources.length; i++)
                        {
                            const resource = resources[i];
                            console.log("Resource " + resource.uri + " now being reindexed.");

                            resource.reindex(indexConnection, function(err, results)
                            {
                                if(err)
                                {
                                    console.error("Error indexing Resource " + resource.uri + " : " + results);
                                }
                            });
                        }

                        return callback(0, null);
                    }
                    else
                    {
                        return callback(1, "Error fetching all resources in the graph : " + results);
                    }
                });
            }
        ],
            function(err, results)
            {
                if(!err)
                {
                    return callback(null, results);
                }
                else
                {
                    return callback(1, results);
                }
            });
    }
    else
    {
        return callback(1, "Non-existent index : " + graphShortName);
    }
};


