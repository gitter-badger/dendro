const Config = function () {
    return GLOBAL.Config;
}();

const isNull = require(Config.absPathInSrcFolder("/utils/null.js")).isNull;
const DbConnection = require(Config.absPathInSrcFolder("/kb/db.js")).DbConnection;
const Class = require(Config.absPathInSrcFolder("/models/meta/class.js")).Class;
const Resource = require(Config.absPathInSrcFolder("/models/resource.js")).Resource;

const moment = require('moment');
const async = require('async');
const db = function () {
    return GLOBAL.db.default;
}();

const mysql = function () {
    return GLOBAL.mysql.pool;
};

function Interaction (object, callback)
{
    Interaction.baseConstructor.call(this, object);
    const self = this;

    self.rdf.type = "ddr:Interaction";

    const now = new Date();

    if(isNull(object.dcterms))
    {
        self.dcterms = {
            created : now.toISOString()
        }
    }
    else
    {
        if(isNull(object.dcterms.created))
        {
            self.dcterms.created = now.toISOString();
        }
        else
        {
            self.dcterms.created = object.dcterms.created;
        }
    }

    if(isNull(self.uri))
    {
        const User = require(Config.absPathInSrcFolder("/models/user.js")).User;
        if(self.ddr.performedBy instanceof Object)
        {
            self.uri = db.baseURI+"/user/"+self.ddr.performedBy.ddr.username+"/interaction/"+self.dcterms.created;
            return callback(null, self);
        }
        else if(typeof self.ddr.performedBy === "string")
        {
            User.findByUri(self.ddr.performedBy, function(err, user){
               if(!err && !isNull(user))
               {
                   self.uri = db.baseURI+"/user/"+user.ddr.username+"/interaction/"+self.dcterms.created;
                   return callback(null, self);
               }
               else
               {
                    return callback(1, "Unable to fetch user with uri " + self.ddr.performedBy);
               }
            });
        }
        else
        {
            return callback(1, "no author user specified for interaction. " + self.ddr.performedBy);
        }
    }
    else
    {
        return callback(0, self);
    }
}

Interaction.all = function(callback, streaming, customGraphUri) {

    const graphUri = (!isNull(customGraphUri) && typeof customGraphUri === "string") ? customGraphUri : db.graphUri;

    const getFullInteractions = function (interactions, callback) {
        const getInteractionInformation = function (interaction, callback) {
            Interaction.findByUri(interaction.uri, callback, null, customGraphUri);
        };

        // get all the information about all the interaction
        // and return the array of interactions, complete with that info
        async.map(interactions, getInteractionInformation, function (err, interactionsToReturn) {
            if (!err) {
                return callback(null, interactionsToReturn);
            }
            else {
                return callback(err, "error fetching interaction information : " + err + "error reported: " + interactionsToReturn);
            }
        });
    };

    if(isNull(streaming) || !streaming)
    {
        var query =
            "SELECT * " +
            "FROM [0] "+
            "WHERE " +
            "{ " +
            " ?uri rdf:type ddr:Interaction " +
            "} ";

        db.connection.execute(query,
            [
                {
                    type: DbConnection.resourceNoEscape,
                    value: graphUri
                }
            ],

            function(err, interactions) {
                if(!err && interactions instanceof Array)
                {
                    getFullInteractions(interactions, function(err, interactions){
                        if(!err)
                        {
                            return callback(null, interactions);
                        }
                        else
                        {
                            return callback(err, interactions);
                        }
                    });
                }
                else
                {
                    //interactions var will contain an error message instead of an array of results.
                    return callback(err, interactions);
                }
            });
    }
    else
    {
        var query =
            "SELECT COUNT (?uri) as ?n_interactions " +
            "FROM [0] " +
            "WHERE " +
            "{ " +
            " ?uri rdf:type ddr:Interaction " +
            "} ";

        db.connection.execute(query,
            [
                {
                    type: DbConnection.resourceNoEscape,
                    value: graphUri
                }
            ],

            function (err, result)
            {
                if (!err && result instanceof Array && result.length === 1)
                {
                    const count = result[0].n_interactions;
                    const n_pages = Math.ceil(count / Config.streaming.db.page_size);
                    const pageNumbersArray = [];

                    for (let i = 0; i <= n_pages; i++)
                    {
                        pageNumbersArray.push(i);
                    }

                    async.mapLimit(pageNumbersArray, Config.recommendation.max_interaction_pushing_threads, function (pageNumber, cb)
                    {
                        console.log("Sending page " + pageNumber + " of " + n_pages);

                        const pageOffset = pageNumber * Config.streaming.db.page_size;

                        /**
                     * TODO Replace with this?
                     *
                     * DECLARE cr KEYSET CURSOR FOR
                     SELECT *
                     FROM
                     (
                     SPARQL SELECT * WHERE { ?s ?p ?o } LIMIT 10
                     ) x

                     * @type {string}
                     */
                        const query =
                            "SELECT ?uri\n" +
                            "WHERE \n" +
                            "{ \n" +
                            "{\n" +
                            "SELECT ?uri \n" +
                            "FROM [0] \n" +
                            "WHERE \n" +
                            "{ \n" +
                            " ?uri rdf:type ddr:Interaction \n" +
                            "} \n" +
                            " ORDER BY ?uri \n" +
                            "}\n" +
                            "} \n" +
                            " OFFSET [1] \n" +
                            " LIMIT [2] \n";

                        db.connection.execute(query,
                            [
                                {
                                    type: DbConnection.resourceNoEscape,
                                    value: graphUri
                                },
                                {
                                    type: DbConnection.int,
                                    value: pageOffset
                                },
                                {
                                    type: DbConnection.int,
                                    value: Config.streaming.db.page_size
                                }
                            ],
                            function (err, interactions)
                            {
                                if (!err && interactions instanceof Array)
                                {
                                    getFullInteractions(interactions, function(err, interactions){
                                        return callback(err, interactions, cb);
                                    });
                                }
                                else
                                {
                                    //interactions var will contain an error message instead of an array of results.
                                    return callback(err, interactions);
                                }
                            });
                    },
                    function (err, results)
                    {
                        if(err)
                        {
                            return callback(err, "Error occurred fetching interactions in streamed mode : " + results);
                        }
                    });
                }
                else
                {
                    return callback(1, "Unable to fetch interaction count. Reported Error : " + result);
                }
            });
    }
};

Interaction.getRandomType = function(restrictions)
{
    let filteredTypes = {};
    if(restrictions instanceof Object)
    {
        for(let restriction in restrictions)
        {
            if(restrictions.hasOwnProperty(restriction))
            {
                for (let key in Interaction.types)
                {
                    if (Interaction.types.hasOwnProperty(key))
                    {
                        const type = Interaction.types[key];
                        if (!isNull(type[restriction]) && type[restriction] === true && restrictions[restriction])
                        {
                            filteredTypes[key] = Interaction.types[key];
                        }
                    }
                }
            }
        }
    }
    else
    {
        filteredTypes = Interaction.types;
    }

    const propertyIndex = Math.round((Object.keys(filteredTypes).length - 1) * Math.random());

    const interactionType = filteredTypes[Object.keys(filteredTypes)[propertyIndex]];

    return interactionType;
};

Interaction.prototype.saveToMySQL = function(callback, overwrite)
{
    const self = this;

    const targetTable = Config.recommendation.getTargetTable();

    const insertNewInteraction = function (callback) {
        const insertNewInteractionQuery = "INSERT INTO ?? " +
            "(" +
            "   uri," +
            "   created," +
            "   modified," +
            "   performedBy," +
            "   interactionType," +
            "   executedOver," +
            "   originallyRecommendedFor," +
            "   rankingPosition," +
            "   pageNumber," +
            "   recommendationCallId," +
            "   recommendationCallTimeStamp" +
            ")" +
            "VALUES " +
            "(" +
            "   ?," +
            "   ?," +
            "   ?," +
            "   ?," +
            "   ?," +
            "   ?," +
            "   ?," +
            "   ?," +
            "   ?," +
            "   ?," +
            "   ?" +
            ");";

        const inserts =
            [
                targetTable,
                self.uri,
                moment(self.dcterms.created, moment.ISO_8601).format("YYYY-MM-DD HH:mm:ss"),
                moment(self.dcterms.created, moment.ISO_8601).format("YYYY-MM-DD HH:mm:ss"),
                self.ddr.performedBy,
                self.ddr.interactionType,
                self.ddr.executedOver,
                self.ddr.originallyRecommendedFor,
                self.ddr.rankingPosition,
                self.ddr.pageNumber,
                self.ddr.recommendationCallId
            ];

        if (!isNull(self.ddr.recommendationCallTimeStamp) && typeof self.ddr.recommendationCallTimeStamp.slice(0, 19) !== "undefined") {
            inserts.push(moment(self.ddr.recommendationCallTimeStamp, moment.ISO_8601).format("YYYY-MM-DD HH:mm:ss"));
        }

        console.log(insertNewInteractionQuery);

        mysql().getConnection(function (err, connection) {
            if (!err) {
                connection.query(
                    insertNewInteractionQuery,
                    inserts,
                    function (err, rows, fields) {
                        if (!err) {
                            return callback(null, rows, fields);
                        }
                        else {
                            const msg = "Error saving interaction to MySQL database : " + err;
                            console.error(msg);
                            return callback(1, msg);
                        }

                    });
            }
            else {
                var msg = "Unable to get MYSQL connection when registering new interaction";
                console.error(msg);
                console.error(err.stack);
                return callback(1, msg);
            }
        });
    };

    if(overwrite)
    {
        insertNewInteraction(function(err, rows, fields){
            return callback(err);
        });
    }
    else
    {
        mysql().getConnection(function(err, connection) {
            if (!err)
            {
                connection.query('SELECT * from ?? WHERE uri = ?', [targetTable, self.uri], function (err, rows, fields)
                {
                    if (!err)
                    {
                        if (!isNull(rows) && rows instanceof Array && rows.length > 0)
                        {
                            //an interaction with the same URI is already recorded, there must be some error!
                            return callback(1, "Interaction with URI " + self.uri + " already recorded in MYSQL.");
                        }
                        else
                        {
                            //insert the new interaction
                            insertNewInteraction(function (err, rows, fields) {
                                if (err) {
                                    return callback(1, "Error inserting new interaction to MYSQL with URI " + self.uri);
                                }
                                else {
                                    return callback(null, rows);
                                }
                            });
                        }
                    }
                    else
                    {
                        return callback(1, "Error seeing if interaction with URI " + self.uri + " already existed in the MySQL database.");
                    }
                });
            }
            else
            {
                const msg = "Unable to get MYSQL connection when registering new interaction";
                console.error(msg);
                console.error(err.stack);
                return callback(1, msg);
            }
        });
    }
};

Interaction.types =
{
    accept_descriptor_from_quick_list : {
        key : "accept_descriptor_from_quick_list",
        positive : true
    },
    accept_descriptor_from_manual_list : {
        key : "accept_descriptor_from_manual_list",
        positive : true
    },
    accept_descriptor_from_manual_list_while_it_was_a_project_favorite : {
        key : "accept_descriptor_from_manual_list_while_it_was_a_project_favorite",
        positive : true
    },
    accept_descriptor_from_manual_list_while_it_was_a_user_favorite : {
        key : "accept_descriptor_from_manual_list_while_it_was_a_user_favorite",
        positive : true
    },
    accept_descriptor_from_manual_list_while_it_was_a_user_and_project_favorite : {
        key : "accept_descriptor_from_manual_list_while_it_was_a_user_and_project_favorite",
        positive : true
    },
    accept_smart_descriptor_in_metadata_editor : {
        key : "accept_smart_descriptor_in_metadata_editor",
        positive : true
    },
    accept_favorite_descriptor_in_metadata_editor : {
        key : "accept_favorite_descriptor_in_metadata_editor",
        positive : true
    },
    accept_descriptor_from_autocomplete : {
        key : "accept_descriptor_from_autocomplete",
        positive : true
    },

    hide_descriptor_from_quick_list_for_project : {
        key : "hide_descriptor_from_quick_list_for_project",
        negative : true
    },

    unhide_descriptor_from_quick_list_for_project : {
        key : "unhide_descriptor_from_quick_list_for_project",
        negative : true
    },

    hide_descriptor_from_quick_list_for_user : {
        key : "hide_descriptor_from_quick_list_for_user",
        negative : true
    },

    unhide_descriptor_from_quick_list_for_user : {
        key : "unhide_descriptor_from_quick_list_for_user",
        negative : true
    },

    reject_descriptor_from_metadata_editor : {
        key : "reject_descriptor_from_metadata_editor",
        negative : true
    },

    favorite_descriptor_from_quick_list_for_user: {
        key : "favorite_descriptor_from_quick_list_for_user",
        positive : true
    },

    unfavorite_descriptor_from_quick_list_for_user: {
        key : "unfavorite_descriptor_from_quick_list_for_user",
        positive : true
    },

    favorite_descriptor_from_quick_list_for_project: {
        key : "favorite_descriptor_from_quick_list_for_project",
        positive : true
    },

    unfavorite_descriptor_from_quick_list_for_project: {
        key : "unfavorite_descriptor_from_quick_list_for_project",
        positive : true
    },

    reject_ontology_from_quick_list : {
        key : "reject_ontology_from_quick_list",
        negative: true
    },

    browse_to_next_page_in_descriptor_list : {
        key : "browse_to_next_page_in_descriptor_list"
    },

    browse_to_previous_page_in_descriptor_list : {
        key : "browse_to_previous_page_in_descriptor_list"
    },

    //manual mode

    select_ontology_manually : {
        key : "select_ontology_manually",
        positive : true
    },

    delete_descriptor_in_metadata_editor : {
        key : "delete_descriptor_in_metadata_editor",
        positive : true
    },

    fill_in_descriptor_from_manual_list_in_metadata_editor : {
        key : "fill_in_descriptor_from_manual_list_in_metadata_editor",
        positive : true
    },

    fill_in_descriptor_from_manual_list_while_it_was_a_user_favorite : {
        key : "fill_in_descriptor_from_manual_list_while_it_was_a_user_favorite",
        positive : true
    },

    fill_in_descriptor_from_manual_list_while_it_was_a_project_favorite : {
        key : "fill_in_descriptor_from_manual_list_while_it_was_a_project_favorite",
        positive : true
    },

    fill_in_descriptor_from_manual_list_while_it_was_a_user_and_project_favorite : {
        key : "fill_in_descriptor_from_manual_list_while_it_was_a_user_and_project_favorite",
        positive : true
    },

    fill_in_descriptor_from_quick_list_in_metadata_editor : {
        key : "fill_in_descriptor_from_quick_list_in_metadata_editor",
        positive : true
    },

    fill_in_descriptor_from_quick_list_while_it_was_a_user_favorite : {
        key : "fill_in_descriptor_from_quick_list_while_it_was_a_user_favorite",
        positive : true
    },

    fill_in_descriptor_from_quick_list_while_it_was_a_project_favorite : {
        key : "fill_in_descriptor_from_quick_list_while_it_was_a_project_favorite",
        positive : true
    },

    fill_in_descriptor_from_quick_list_while_it_was_a_user_and_project_favorite : {
        key : "fill_in_descriptor_from_quick_list_while_it_was_a_user_and_project_favorite",
        positive : true
    },


    fill_in_inherited_descriptor : {
        key : "fill_in_inherited_descriptor",
        label : "Fill in inherited descriptor"
    }
};

Interaction.prefixedRDFType = "ddr:Interaction";

Interaction = Class.extend(Interaction, Resource);

module.exports.Interaction = Interaction;