const Config = function () {
    return GLOBAL.Config;
}();

const isNull = require(Config.absPathInSrcFolder("/utils/null.js")).isNull;
const Class = require(Config.absPathInSrcFolder("/models/meta/class.js")).Class;
const Ontology = require(Config.absPathInSrcFolder("/models/meta/ontology.js")).Ontology;
const Descriptor = require(Config.absPathInSrcFolder("/models/meta/descriptor.js")).Descriptor;
const DbConnection = require(Config.absPathInSrcFolder("/kb/db.js")).DbConnection;
const Resource = require(Config.absPathInSrcFolder("/models/resource.js")).Resource;
const Interaction = require(Config.absPathInSrcFolder("/models/recommendation/interaction.js")).Interaction;

const util = require('util');
const async = require('async');
const _ = require('underscore');
const path = require('path');

const db = function () {
    return GLOBAL.db.default;
}();
const gfs = function () {
    return GLOBAL.gfs.default;
}();

function User (object)
{
    User.baseConstructor.call(this, object);
    const self = this;

    if(isNull(self.uri))
    {
        self.uri = db.baseURI+"/user/"+self.ddr.username;
    }

    if(isNull(self.ddr.salt))
    {
        const bcrypt = require('bcryptjs');

        if(process.env.NODE_ENV !== "test")
        {
            self.ddr.salt = bcrypt.genSaltSync(10);
        }
        else
        {
            self.ddr.salt = bcrypt.genSaltSync(1);
        }
    }

    self.rdf.type = "ddr:User";

    return self;
}

User.findByORCID = function(orcid, callback, removePrivateDescriptors)
{
    User.findByPropertyValue(orcid, "ddr:orcid", function(err, user){
        if(!err && typeof user != null && user instanceof User)
        {
            if(removePrivateDescriptors)
            {
                user.clearDescriptors([Config.types.private, Config.types.locked], [Config.types.public, Config.types.api_readable]);
                return callback(err, user);
            }
            else
            {
                return callback(err, user);
            }
        }
        else
        {
            return callback(err, user);
        }
    });
};

User.findByUsername = function(username, callback, removePrivateDescriptors)
{
    User.findByPropertyValue(username, "ddr:username", function(err, user){
        if(!err && !isNull(user) && user instanceof User)
        {
            if(removePrivateDescriptors)
            {
                user.clearDescriptors([Config.types.private, Config.types.locked], [Config.types.public, Config.types.api_readable]);
                return callback(err, user);
            }
            else
            {
                return callback(err, user);
            }
        }
        else
        {
            return callback(err, user);
        }
    });
};

User.findByEmail = function(email, callback)
{
    User.findByPropertyValue(email, "foaf:mbox", callback);
};

User.autocomplete_search = function(value, maxResults, callback) {

    if(Config.debug.users.log_fetch_by_username)
    {
        console.log("finding by username " + username);
    }

    const query =
        "SELECT * \n" +
        "FROM [0] \n" +
        "WHERE \n" +
        "{ \n" +
        "   ?uri rdf:type [1] . \n" +
        "   ?uri foaf:firstName ?firstname . \n" +
        "   ?uri foaf:surname ?surname . \n" +
        "   ?uri ddr:username ?username . \n" +
        "   FILTER (regex(?firstname, [2], [3]) || regex(?surname, [2], [3]) || regex(?username, [2], [3])). \n" +
        "} \n" +
        " LIMIT [4]";


    db.connection.execute(query,
        [
            {
                type : DbConnection.resourceNoEscape,
                value : db.graphUri
            },
            {
                type : DbConnection.prefixedResource,
                value : User.prefixedRDFType
            },
            {
                type : DbConnection.string,
                value : value
            },
            {
                type : DbConnection.string,
                value : "i"
            },
            {
                type : DbConnection.int,
                value : maxResults
            }
        ],

        function(err, users) {
            if(!err && users instanceof Array)
            {
                const getUserProperties = function (resultRow, cb) {
                    User.findByUri(resultRow.uri, function (err, user) {
                        cb(err, user);
                    });
                };

                async.map(users, getUserProperties, function(err, results){
                    return callback(err, results);
                })
            }
            else
            {
                return callback(err, user);
            }
        });
};

User.findByPropertyValue = function(value, propertyInPrefixedForm, callback) {

    if(Config.debug.users.log_fetch_by_username)
    {
        console.log("finding by username " + username);
    }

    const query =
        "SELECT * \n" +
        "FROM [0] \n" +
        "WHERE \n" +
        "{ \n" +
        " ?uri [1] [2] . \n" +
        "} \n";


    db.connection.execute(query,
        [
            {
                type : DbConnection.resourceNoEscape,
                value : db.graphUri
            },
            {
                type : DbConnection.prefixedResource,
                value : propertyInPrefixedForm
            },
            {
                type : DbConnection.string,
                value : value
            }
        ],

        function(err, user) {
            if(!err)
            {
                if(user.length > 1)
                {
                    console.log("Duplicate username "+username+" found!!!!")
                }

                else if(user.length === 1)
                {
                    const uri = user[0].uri;
                    User.findByUri(uri, function(err, fetchedUser)
                    {
                        if(!err)
                        {
                            const userToReturn = new User(fetchedUser);

                            return callback(err, fetchedUser);

                            /*userToReturn.loadOntologyRecommendations(function(err, user){

                            });*/
                        }
                        else
                        {
                            return callback(1, "Unable to fetch user with uri :" + uri + ". Error reported : " + fetchedUser);
                        }
                    });
                }
                else
                {
                    return callback(0,null);
                }
            }
            else
            {
                return callback(err, user);
            }
        });
};

User.createAndInsertFromObject = function(object, callback) {

    const self = new User(object);

    console.log("creating user from object" + util.inspect(object));

    //encrypt password
    const bcrypt = require('bcryptjs');
    bcrypt.hash(self.ddr.password, self.ddr.salt, function(err, password){
        if(!err)
        {
            self.ddr.password = password;

            self.save(function(err, newUser) {
                if(!err)
                {
                    if(newUser instanceof User)
                    {
                        return callback(null, newUser);
                    }
                    else
                    {
                        return callback(null, false);
                    }
                }
                else
                {
                    return callback(err, newUser);
                }
            });
        }
        else
        {
            return callback(err, password);
        }
    });
};


User.all = function(callback, req, customGraphUri, descriptorTypesToRemove, descriptorTypesToExemptFromRemoval)
{
    const self = this;
    User.baseConstructor.all.call(self, function(err, users) {

        return callback(err, users);

    }, req, customGraphUri, descriptorTypesToRemove, descriptorTypesToExemptFromRemoval);
};

User.allInPage = function(page, pageSize, callback) {
    let query =
        "SELECT ?uri ?firstName ?surname ?username ?email\n" +
        "WHERE \n" +
        "{ \n" +
        " ?uri rdf:type ddr:User . \n" +
        " ?uri foaf:surname ?surname .\n" +
        " ?uri foaf:firstName ?firstName .\n" +
        " ?uri foaf:mbox ?email .\n" +
        " ?uri ddr:username ?username .\n" +
        "} ";

    const skip = pageSize * page;

    if(req.query.pageSize > 0)
    {
        query = query + " LIMIT " + pageSize;
    }

    if(skip > 0)
    {
        query = query + " OFFSET " + skip;
    }

    db.connection.execute(query,
        [],
        function(err, users) {
            if(!err)
            {
                if(users instanceof Array)
                {
                    //get all the information about all the projects
                    // and return the array of projects, complete with that info
                    async.map(users, User.findByUri, function(err, usersToReturn)
                    {
                        if(!err)
                        {
                            return callback(null, usersToReturn);
                        }
                        else
                        {
                            return callback("error fetching user information : " + err, usersToReturn);
                        }
                    });
                }
            }
            else
            {
                return callback(1, users);
            }
        });
};

/**
 * Fetch ontology recommendations for this user
 * @param callback
 */
User.prototype.loadOntologyRecommendations = function(callback)
{
    const self = this;
    if(isNull(self.recommendations))
    {
        self.recommendations = {
            ontologies : {
                accepted : {},
                rejected : {}
            }
        };
    }

    return callback(null, self);
};

/**
 * Save ontology recommendations for this user
 * @param callback
 */
User.prototype.saveOntologyRecommendations = function(callback)
{
    return callback(null,
        {
            accepted : {},
            rejected : {}
        });
};

User.prototype.getInteractions = function(callback)
{
    const self = this;
    const query =
        "SELECT ?interaction ?user ?type ?object ?created\n" +
        "FROM [0] \n" +
        "WHERE \n" +
        "{ \n" +
        " ?interaction rdf:type ddr:Interaction . \n" +
        " ?interaction ddr:performedBy [1] .\n" +
        " ?interaction ddr:interactionType ?type. \n" +
        " ?interaction ddr:executedOver ?object .\n" +
        " ?interaction dcterms:created ?created. \n" +
        "} \n";

    db.connection.execute(query, [
        {
            type: DbConnection.resourceNoEscape,
            value : db.graphUri
        },
        {
            type : DbConnection.resource,
            value : self.uri
        }
    ], function(err, results) {
        if(!err)
        {
            if(!isNull(results) && results instanceof Array)
            {
                const createInteraction = function (result, callback) {
                    new Interaction({
                        uri: result.interaction,
                        ddr: {
                            performedBy: self.uri,
                            interactionType: result.type,
                            executedOver: result.object
                        },
                        dcterms: {
                            created: result.created
                        }
                    }, function (err, fullInteraction) {
                        return callback(err, fullInteraction);
                    });
                };

                async.map(results, createInteraction, function(err, fullInteractions)
                {
                    return callback(err, fullInteractions);
                });
            }
        }
        else
        {
            return callback(err, results);
        }
    });
};

User.prototype.hiddenDescriptors = function(maxResults, callback, allowedOntologies)
{
    const self = this;

    //TODO FIXME JROCHA necessary to make two queries because something is wrong with virtuoso. making an UNION of both and projecting with SELECT * mixes up the descriptors!

    const createDescriptorsList = function (descriptors, callback) {
        const createDescriptor = function (result, callback) {
            const suggestion = new Descriptor({
                uri: result.descriptor,
                label: result.label,
                comment: result.comment
            });


            //set recommendation type
            suggestion.recommendation_types = {};

            //TODO JROCHA Figure out under which circumstances this is null
            if (typeof Descriptor.recommendation_types !== "undefined") {
                suggestion.recommendation_types[Descriptor.recommendation_types.user_hidden.key] = true;
            }

            suggestion.last_hidden = result.last_hidden;
            suggestion.last_unhidden = Date.parse(result.last_unhidden);

            if (suggestion instanceof Descriptor && suggestion.isAuthorized([Config.types.private, Config.types.locked])) {
                return callback(0, suggestion);
            }
            else {
                return callback(0, null);
            }
        };

        async.map(descriptors, createDescriptor, function (err, fullDescriptors) {
            if (!err) {
                /**remove nulls (that were unauthorized descriptors)**/
                fullDescriptors = _.without(fullDescriptors, null);

                return callback(null, fullDescriptors);
            }
            else {
                return callback(1, null);
            }
        });
    };

    let argumentsArray =
        [
            {
                value: db.graphUri,
                type: DbConnection.resourceNoEscape
            },
            {
                value: self.uri,
                type: DbConnection.resourceNoEscape
            },
            {
                value: Interaction.types.hide_descriptor_from_quick_list_for_user.key,
                type: DbConnection.string
            },
            {
                value: Interaction.types.unhide_descriptor_from_quick_list_for_user.key,
                type: DbConnection.string
            }
        ];

    const publicOntologies = Ontology.getPublicOntologiesUris();
    if(!isNull(allowedOntologies) && allowedOntologies instanceof Array)
    {
        allowedOntologies = _.intersection(publicOntologies, allowedOntologies);
    }
    else
    {
        allowedOntologies = publicOntologies;
    }

    let fromString = "";

    const fromElements = DbConnection.buildFromStringAndArgumentsArrayForOntologies(allowedOntologies, argumentsArray.length);
    argumentsArray = argumentsArray.concat(fromElements.argumentsArray);
    fromString = fromString + fromElements.fromString;

    const filterString = DbConnection.buildFilterStringForOntologies(allowedOntologies, "hidden_descriptor");

    const query =
        "SELECT * \n" +
        "{ \n" +
        "	{ \n" +
        "		SELECT ?hidden_descriptor as ?descriptor ?label ?comment ?last_hidden ?last_unhidden \n" +
        fromString + "\n" +
        "		WHERE \n" +
        "		{ \n" +
        "			?hidden_descriptor rdfs:label ?label.  \n" +
        "			?hidden_descriptor rdfs:comment ?comment.  \n" +
        "			FILTER(    (str(?label) != \"\") && ( str(?comment) != \"\") ).  \n" +
        "			FILTER(   lang(?label) = \"\" || lang(?label) = \"en\") .  \n" +
        "			FILTER(   lang(?comment) = \"\" || lang(?comment) = \"en\")   \n" +
        filterString + "\n" +
        "			 \n" +
        "			{ \n" +
        "				SELECT ?hidden_descriptor MAX(?date_hidden) as ?last_hidden \n" +
        "				FROM [0]  \n" +
        "				WHERE  \n" +
        "				{  \n" +
        "				   	?hide_interaction rdf:type ddr:Interaction. \n" +
        "				   	?hide_interaction ddr:executedOver ?hidden_descriptor. \n" +
        "				   	?hide_interaction ddr:interactionType [2]. \n" +
        "				   	?hide_interaction ddr:performedBy [1] .  \n" +
        "				   	?hide_interaction dcterms:created ?date_hidden. \n" +
        "					FILTER NOT EXISTS \n" +
        "					{ \n" +
        "						SELECT ?unhidden_descriptor MAX(?date_unhidden) as ?last_unhidden \n" +
        "						FROM [0]  \n" +
        "						WHERE  \n" +
        "						{  \n" +
        "				   			?unhide_interaction rdf:type ddr:Interaction. \n" +
        "				   			?unhide_interaction ddr:executedOver ?hidden_descriptor. \n" +
        "				   			?unhide_interaction ddr:executedOver ?unhidden_descriptor. \n" +
        "				   			?unhide_interaction ddr:interactionType [3]. \n" +
        "				   			?unhide_interaction ddr:performedBy [1] .  \n" +
        "				   			?unhide_interaction dcterms:created ?date_unhidden. \n" +
        "						} \n" +
        "					} \n" +
        "				} \n" +
        "			} \n" +
        "		} \n" +
        "	} \n" +
        "	UNION \n" +
        "	{ \n" +
        "		SELECT ?hidden_descriptor as ?descriptor ?label ?comment ?last_hidden ?last_unhidden \n" +
        fromString + "\n" +
        "		WHERE \n" +
        "		{ \n" +
        "			?hidden_descriptor rdfs:label ?label.  \n" +
        "			?hidden_descriptor rdfs:comment ?comment.  \n" +
        "			FILTER(    (str(?label) != \"\") && ( str(?comment) != \"\") ).  \n" +
        "			FILTER(   lang(?label) = \"\" || lang(?label) = \"en\") .  \n" +
        "			FILTER(   lang(?comment) = \"\" || lang(?comment) = \"en\")   \n" +
        filterString + "\n" +
        "			 \n" +
        "			{ \n" +
        "				SELECT ?hidden_descriptor MAX(?date_hidden) as ?last_hidden \n" +
        "				FROM [0]  \n" +
        "				WHERE  \n" +
        "				{  \n" +
        "				   	?hide_interaction rdf:type ddr:Interaction. \n" +
        "				   	?hide_interaction ddr:executedOver ?hidden_descriptor. \n" +
        "				   	?hide_interaction ddr:interactionType [2] . \n" +
        "				   	?hide_interaction ddr:performedBy [1] .  \n" +
        "				   	?hide_interaction dcterms:created ?date_hidden. \n" +
        "				} \n" +
        "			}. \n" +
        "			{ \n" +
        "				SELECT ?hidden_descriptor MAX(?date_unhidden) as ?last_unhidden \n" +
        "				FROM [0]  \n" +
        "				WHERE  \n" +
        "				{  \n" +
        "				   	?unhide_interaction rdf:type ddr:Interaction. \n" +
        "				   	?unhide_interaction ddr:executedOver ?hidden_descriptor. \n" +
        "				   	?unhide_interaction ddr:interactionType [3]. \n" +
        "				   	?unhide_interaction ddr:performedBy [1] .  \n" +
        "				   	?unhide_interaction dcterms:created ?date_unhidden. \n" +
        "				} \n" +
        "			} \n" +
        "		   	FILTER(bound(?last_unhidden) && ?last_hidden > ?last_unhidden) \n" +
        "		} \n" +
        "	} \n" +
        "} \n";

    db.connection.execute(
        query,
        argumentsArray,

        function(err, hidden) {
            if(!err)
            {
                createDescriptorsList(hidden, function(err, fullDescriptors){
                    return callback(err, fullDescriptors);
                });
            }
            else
            {
                const msg = "Unable to fetch hidden descriptors of the user " + self.uri + ". Error reported: " + hidden;
                console.log(msg);
                return callback(err, hidden);
            }
        }
    );
};

User.prototype.favoriteDescriptors = function(maxResults, callback, allowedOntologies)
{
    const self = this;

    //TODO FIXME JROCHA necessary to make two queries because something is wrong with virtuoso. making an UNION of both and projecting with SELECT * mixes up the descriptors!

    const createDescriptorsList = function (descriptors, callback) {
        const createDescriptor = function (result, callback) {
            const suggestion = new Descriptor({
                uri: result.descriptor,
                label: result.label,
                comment: result.comment
            });


            //set recommendation type
            suggestion.recommendation_types = {};

            //TODO JROCHA Figure out under which circumstances this is null
            if (typeof Descriptor.recommendation_types !== "undefined") {
                suggestion.recommendation_types[Descriptor.recommendation_types.user_favorite.key] = true;
            }

            suggestion.last_favorited = result.last_favorited;
            suggestion.last_unfavorited = Date.parse(result.last_unfavorited);

            if (suggestion instanceof Descriptor && suggestion.isAuthorized([Config.types.private, Config.types.locked])) {
                return callback(0, suggestion);
            }
            else {
                return callback(0, null);
            }
        };

        async.map(descriptors, createDescriptor, function (err, fullDescriptors) {
            if (!err) {
                /**remove nulls (that were unauthorized descriptors)**/
                fullDescriptors = _.without(fullDescriptors, null);

                return callback(null, fullDescriptors);
            }
            else {
                return callback(1, null);
            }
        });
    };

    let argumentsArray =
        [
            {
                value: db.graphUri,
                type: DbConnection.resourceNoEscape
            },
            {
                value: self.uri,
                type: DbConnection.resourceNoEscape
            },
            {
                value: Interaction.types.favorite_descriptor_from_quick_list_for_user.key,
                type: DbConnection.string
            },
            {
                value: Interaction.types.unfavorite_descriptor_from_quick_list_for_user.key,
                type: DbConnection.string
            }
    ];

    const publicOntologies = Ontology.getPublicOntologiesUris();
    if(!isNull(allowedOntologies) && allowedOntologies instanceof Array)
    {
        allowedOntologies = _.intersection(publicOntologies, allowedOntologies);
    }
    else
    {
        allowedOntologies = publicOntologies;
    }

    let fromString = "";

    const fromElements = DbConnection.buildFromStringAndArgumentsArrayForOntologies(allowedOntologies, argumentsArray.length);
    argumentsArray = argumentsArray.concat(fromElements.argumentsArray);
    fromString = fromString + fromElements.fromString;

    const filterString = DbConnection.buildFilterStringForOntologies(allowedOntologies, "favorited_descriptor");

    const query =
        "SELECT * \n" +
        "{ \n" +
        "	{ \n" +
        "		SELECT ?favorited_descriptor as ?descriptor ?label ?comment ?last_favorited ?last_unfavorited \n" +
        fromString + "\n" +
        "		WHERE \n" +
        "		{ \n" +
        "			?favorited_descriptor rdfs:label ?label.  \n" +
        "			?favorited_descriptor rdfs:comment ?comment.  \n" +
        "			FILTER(    (str(?label) != \"\") && ( str(?comment) != \"\") ).  \n" +
        "			FILTER(   lang(?label) = \"\" || lang(?label) = \"en\") .  \n" +
        "			FILTER(   lang(?comment) = \"\" || lang(?comment) = \"en\")   \n" +
        filterString + "\n" +
        "			 \n" +
        "			{ \n" +
        "				SELECT ?favorited_descriptor MAX(?date_favorited) as ?last_favorited \n" +
        "				FROM [0]  \n" +
        "				WHERE  \n" +
        "				{  \n" +
        "				   	?favorite_interaction rdf:type ddr:Interaction. \n" +
        "				   	?favorite_interaction ddr:executedOver ?favorited_descriptor. \n" +
        "				   	?favorite_interaction ddr:interactionType [2]. \n" +
        "				   	?favorite_interaction ddr:performedBy [1] .  \n" +
        "				   	?favorite_interaction dcterms:created ?date_favorited. \n" +
        "					FILTER NOT EXISTS \n" +
        "					{ \n" +
        "						SELECT ?unfavorited_descriptor MAX(?date_unfavorited) as ?last_unfavorited \n" +
        "						FROM [0]  \n" +
        "						WHERE  \n" +
        "						{  \n" +
        "				   			?unfavorite_interaction rdf:type ddr:Interaction. \n" +
        "				   			?unfavorite_interaction ddr:executedOver ?favorited_descriptor. \n" +
        "				   			?unfavorite_interaction ddr:executedOver ?unfavorited_descriptor. \n" +
        "				   			?unfavorite_interaction ddr:interactionType [3]. \n" +
        "				   			?unfavorite_interaction ddr:performedBy [1] .  \n" +
        "				   			?unfavorite_interaction dcterms:created ?date_unfavorited. \n" +
        "						} \n" +
        "					} \n" +
        "				} \n" +
        "			} \n" +
        "		} \n" +
        "	} \n" +
        "	UNION \n" +
        "	{ \n" +
        "		SELECT ?favorited_descriptor as ?descriptor ?label ?comment ?last_favorited ?last_unfavorited \n" +
        fromString + "\n" +
        "		WHERE \n" +
        "		{ \n" +
        "			?favorited_descriptor rdfs:label ?label.  \n" +
        "			?favorited_descriptor rdfs:comment ?comment.  \n" +
        "			FILTER(    (str(?label) != \"\") && ( str(?comment) != \"\") ).  \n" +
        "			FILTER(   lang(?label) = \"\" || lang(?label) = \"en\") .  \n" +
        "			FILTER(   lang(?comment) = \"\" || lang(?comment) = \"en\")   \n" +
        filterString + "\n" +
        "			 \n" +
        "			{ \n" +
        "				SELECT ?favorited_descriptor MAX(?date_favorited) as ?last_favorited \n" +
        "				FROM [0]  \n" +
        "				WHERE  \n" +
        "				{  \n" +
        "				   	?favorite_interaction rdf:type ddr:Interaction. \n" +
        "				   	?favorite_interaction ddr:executedOver ?favorited_descriptor. \n" +
        "				   	?favorite_interaction ddr:interactionType [2] . \n" +
        "				   	?favorite_interaction ddr:performedBy [1] .  \n" +
        "				   	?favorite_interaction dcterms:created ?date_favorited. \n" +
        "				} \n" +
        "			}. \n" +
        "			{ \n" +
        "				SELECT ?favorited_descriptor MAX(?date_unfavorited) as ?last_unfavorited \n" +
        "				FROM [0]  \n" +
        "				WHERE  \n" +
        "				{  \n" +
        "				   	?unfavorite_interaction rdf:type ddr:Interaction. \n" +
        "				   	?unfavorite_interaction ddr:executedOver ?favorited_descriptor. \n" +
        "				   	?unfavorite_interaction ddr:interactionType [3]. \n" +
        "				   	?unfavorite_interaction ddr:performedBy [1] .  \n" +
        "				   	?unfavorite_interaction dcterms:created ?date_unfavorited. \n" +
        "				} \n" +
        "			} \n" +
        "		   	FILTER(bound(?last_unfavorited) && ?last_favorited > ?last_unfavorited) \n" +
        "		} \n" +
        "	} \n" +
        "} \n";

    db.connection.execute(
        query,
        argumentsArray,

        function(err, favorites) {
            if(!err)
            {
                createDescriptorsList(favorites, function(err, fullDescriptors){
                    return callback(err, fullDescriptors);
                });
            }
            else
            {
                const msg = "Unable to fetch favorite descriptors of the user " + self.uri + ". Error reported: " + favorites;
                console.log(msg);
                return callback(err, favorites);
            }
        }
    );
};

User.prototype.mostAcceptedFavoriteDescriptorsInMetadataEditor = function(maxResults, callback, allowedOntologies)
{
    const self = this;
    let argumentsArray = [
        {
            value: db.graphUri,
            type: DbConnection.resourceNoEscape
        },
        {
            value: Interaction.types.accept_favorite_descriptor_in_metadata_editor.key,
            type: DbConnection.string
        },
        {
            value: self.uri,
            type: DbConnection.resourceNoEscape
        }
    ];

    const publicOntologies = Ontology.getPublicOntologiesUris();
    if(!isNull(allowedOntologies) && allowedOntologies instanceof Array)
    {
        allowedOntologies = _.intersection(publicOntologies, allowedOntologies);
    }
    else
    {
        allowedOntologies = publicOntologies;
    }

    let fromString = "";

    const fromElements = DbConnection.buildFromStringAndArgumentsArrayForOntologies(allowedOntologies, argumentsArray.length);
    argumentsArray = argumentsArray.concat(fromElements.argumentsArray);
    fromString = fromString + fromElements.fromString;

    const filterString = DbConnection.buildFilterStringForOntologies(allowedOntologies, "accepted_descriptor");

    const query =

        "SELECT ?accepted_descriptor ?times_favorite_accepted_in_md_editor ?label ?comment \n" +
        fromString + "\n" +
        "WHERE \n" +
        "{ \n" +
        "    { \n" +
        "        SELECT ?accepted_descriptor COUNT(?accept_interaction) as ?times_favorite_accepted_in_md_editor \n" +
        "        FROM [0] \n" +
        "        WHERE \n" +
        "        { \n" +
        "            ?accept_interaction ddr:executedOver ?accepted_descriptor. \n" +
        "            ?accept_interaction rdf:type ddr:Interaction. \n" +
        "            ?accept_interaction ddr:interactionType [1]. \n" +
        "            ?accept_interaction ddr:performedBy [2]. \n" +
        "            " + filterString + "\n" +
        "        } \n" +
        "    }. \n" +

        "    ?accepted_descriptor rdfs:label ?label. \n" +
        "    ?accepted_descriptor rdfs:comment ?comment. \n" +

        "    FILTER(    (str(?label) != \"\") && ( str(?comment) != \"\") ). \n" +
        "    FILTER(   lang(?label) = \"\" || lang(?label) = \"en\") . \n" +
        "    FILTER(   lang(?comment) = \"\" || lang(?comment) = \"en\") \n" +
        "} \n";

    db.connection.execute(
        query,
        argumentsArray,

        function(err, descriptors) {
            if(!err)
            {
                const createDescriptor = function (result, callback) {

                    const suggestion = new Descriptor({
                        uri: result.accepted_descriptor,
                        label: result.label,
                        comment: result.comment
                    });

                    //set recommendation type
                    suggestion.recommendation_types = {};

                    //TODO JROCHA Figure out under which circumstances this is null
                    if (typeof Descriptor.recommendation_types !== "undefined") {
                        suggestion.recommendation_types[Descriptor.recommendation_types.favorite_accepted_in_metadata_editor.key] = true;
                    }

                    if (result.times_favorite_accepted_in_md_editor <= 0) {
                        console.error("Descriptor " + suggestion.uri + " recommended for acceptance in metadata editor (SMART) with invalid number of usages : " + result.times_favorite_accepted_in_md_editor);
                    }

                    suggestion.times_favorite_accepted_in_md_editor = parseInt(result.times_favorite_accepted_in_md_editor);

                    if (suggestion instanceof Descriptor && suggestion.isAuthorized([Config.types.private, Config.types.locked])) {
                        return callback(0, suggestion);
                    }
                    else {
                        return callback(0, null);
                    }
                };

                async.map(descriptors, createDescriptor, function(err, fullDescriptors)
                {
                    if(!err)
                    {
                        /**remove nulls (that were unauthorized descriptors)**/
                        fullDescriptors = _.without(fullDescriptors, null);

                        return callback(null, fullDescriptors);
                    }
                    else
                    {
                        return callback(1, null);
                    }
                });
            }
            else
            {
                const util = require('util');
                console.error("Error fetching most accepted favorite descriptors for user " + self.uri + " : " + descriptors);
                return callback(1, descriptors);
            }
        });
};

User.prototype.mostAcceptedSmartDescriptorsInMetadataEditor = function(maxResults, callback, allowedOntologies)
{
    const self = this;
    let argumentsArray = [
        {
            value: db.graphUri,
            type: DbConnection.resourceNoEscape
        },
        {
            value: Interaction.types.accept_smart_descriptor_in_metadata_editor.key,
            type: DbConnection.string
        },
        {
            value: self.uri,
            type: DbConnection.resourceNoEscape
        }
    ];

    const publicOntologies = Ontology.getPublicOntologiesUris();
    if(!isNull(allowedOntologies) && allowedOntologies instanceof Array)
    {
        allowedOntologies = _.intersection(publicOntologies, allowedOntologies);
    }
    else
    {
        allowedOntologies = publicOntologies;
    }

    let fromString = "";

    const fromElements = DbConnection.buildFromStringAndArgumentsArrayForOntologies(allowedOntologies, argumentsArray.length);
    argumentsArray = argumentsArray.concat(fromElements.argumentsArray);
    fromString = fromString + fromElements.fromString;

    const filterString = DbConnection.buildFilterStringForOntologies(allowedOntologies, "accepted_descriptor");

    const query =

        "SELECT ?accepted_descriptor ?times_smart_accepted_in_md_editor ?label ?comment \n" +
        fromString + "\n" +
        "WHERE \n" +
        "{ \n" +
        "    { \n" +
        "        SELECT ?accepted_descriptor COUNT(?accept_interaction) as ?times_smart_accepted_in_md_editor \n" +
        "        FROM [0] \n" +
        "        WHERE \n" +
        "        { \n" +
        "            ?accept_interaction ddr:executedOver ?accepted_descriptor. \n" +
        "            ?accept_interaction rdf:type ddr:Interaction. \n" +
        "            ?accept_interaction ddr:interactionType [1]. \n" +
        "            ?accept_interaction ddr:performedBy [2]. \n" +
        "            " + filterString + "\n" +
        "        } \n" +
        "    }. \n" +

        "    ?accepted_descriptor rdfs:label ?label. \n" +
        "    ?accepted_descriptor rdfs:comment ?comment. \n" +

        "    FILTER(    (str(?label) != \"\") && ( str(?comment) != \"\") ). \n" +
        "    FILTER(   lang(?label) = \"\" || lang(?label) = \"en\") . \n" +
        "    FILTER(   lang(?comment) = \"\" || lang(?comment) = \"en\") \n" +
        "} \n";

    db.connection.execute(
        query,
        argumentsArray,

        function(err, descriptors) {
            if(!err)
            {
                const createDescriptor = function (result, callback) {

                    const suggestion = new Descriptor({
                        uri: result.accepted_descriptor,
                        label: result.label,
                        comment: result.comment
                    });

                    //set recommendation type
                    suggestion.recommendation_types = {};

                    //TODO JROCHA Figure out under which circumstances this is null
                    if (typeof Descriptor.recommendation_types !== "undefined") {
                        suggestion.recommendation_types[Descriptor.recommendation_types.smart_accepted_in_metadata_editor.key] = true;
                    }

                    if (result.times_smart_accepted_in_md_editor <= 0) {
                        console.error("Descriptor " + suggestion.uri + " recommended for acceptance in metadata editor (SMART) with invalid number of usages : " + result.times_smart_accepted_in_md_editor);
                    }

                    suggestion.times_smart_accepted_in_md_editor = parseInt(result.times_smart_accepted_in_md_editor);

                    if (suggestion instanceof Descriptor && suggestion.isAuthorized([Config.types.private, Config.types.locked])) {
                        return callback(0, suggestion);
                    }
                    else {
                        return callback(0, null);
                    }
                };

                async.map(descriptors, createDescriptor, function(err, fullDescriptors)
                {
                    if(!err)
                    {
                        /**remove nulls (that were unauthorized descriptors)**/
                        fullDescriptors = _.without(fullDescriptors, null);

                        return callback(null, fullDescriptors);
                    }
                    else
                    {
                        return callback(1, null);
                    }
                });
            }
            else
            {
                const util = require('util');
                console.error("Error fetching most accepted smart descriptors for user " + self.uri + " : " + descriptors);
                return callback(1, descriptors);
            }
        });
};

User.prototype.mostRecentlyFilledInDescriptors = function(maxResults, callback, allowedOntologies)
{
    const self = this;
    let argumentsArray = [
        {
            value: db.graphUri,
            type: DbConnection.resourceNoEscape
        }
    ];

    const publicOntologies = Ontology.getPublicOntologiesUris();
    if(!isNull(allowedOntologies) && allowedOntologies instanceof Array)
    {
        allowedOntologies = _.intersection(publicOntologies, allowedOntologies);
    }
    else
    {
        allowedOntologies = publicOntologies;
    }

    let fromString = "";

    const fromElements = DbConnection.buildFromStringAndArgumentsArrayForOntologies(allowedOntologies, argumentsArray.length);
    argumentsArray = argumentsArray.concat(fromElements.argumentsArray);
    fromString = fromString + fromElements.fromString;

    const filterString = DbConnection.buildFilterStringForOntologies(allowedOntologies, "descriptor");

    const query =
    "SELECT ?descriptor ?recent_use_count ?last_use ?label ?comment " +
    fromString + "\n" +
    "WHERE \n" +
    "{ \n" +
    "{ \n" +
    "SELECT ?descriptor COUNT(?descriptor) as ?recent_use_count MAX(?used_date) as ?last_use \n" +
    "FROM [0] \n" +
    "WHERE \n" +
    "{ \n" +
    "?change rdf:type ddr:Change. \n" +
    "?change ddr:changedDescriptor ?descriptor. \n" +
    "?change ddr:pertainsTo ?version. \n" +
    "?version rdf:type ddr:ArchivedResource .\n" +
    "?version ddr:versionCreator [" + argumentsArray.length + "] .\n" +

    "OPTIONAL { ?descriptor rdfs:label ?label. }\n" +
    "OPTIONAL { ?descriptor rdfs:comment ?comment. }\n" +
    "?version dcterms:created ?used_date. \n" +
    filterString + "\n" +
    "} " +
    "ORDER BY DESC(?last_use) \n" +
    " LIMIT " + maxResults + "\n" +
    "}. \n" +
    "?descriptor rdfs:label ?label. \n" +
    "?descriptor rdfs:comment ?comment. \n" +
    "FILTER(    (str(?label) != \"\") && ( str(?comment) != \"\") ). \n" +
    "FILTER(   lang(?label) = \"\" || lang(?label) = \"en\") . \n" +
    "FILTER(   lang(?comment) = \"\" || lang(?comment) = \"en\")  \n" +
    "} \n";

    argumentsArray = argumentsArray.concat([{
        value : self.uri,
        type : DbConnection.resourceNoEscape
    }]);

    db.connection.execute(
        query,
        argumentsArray,

        function(err, descriptors) {
            if(!err)
            {
                const createDescriptor = function (result, callback) {

                    const suggestion = new Descriptor({
                        uri: result.descriptor,
                        label: result.label,
                        comment: result.comment
                    });

                    //set recommendation type
                    suggestion.recommendation_types = {};

                    //TODO JROCHA Figure out under which circumstances this is null
                    if (typeof Descriptor.recommendation_types !== "undefined") {
                        suggestion.recommendation_types[Descriptor.recommendation_types.recently_used.key] = true;
                    }

                    if (result.recent_use_count <= 0) {
                        console.error("Descriptor " + suggestion.uri + " recommended for recent use with invalid number of usages : " + result.recent_use_count);
                    }

                    suggestion.recent_use_count = parseInt(result.recent_use_count);
                    suggestion.last_use = Date.parse(result.last_use);

                    if (suggestion instanceof Descriptor && suggestion.isAuthorized([Config.types.private, Config.types.locked])) {
                        return callback(0, suggestion);
                    }
                    else {
                        return callback(0, null);
                    }
                };

                async.map(descriptors, createDescriptor, function(err, fullDescriptors)
                {
                    if(!err)
                    {
                        /**remove nulls (that were unauthorized descriptors)**/
                        fullDescriptors = _.without(fullDescriptors, null);

                        return callback(null, fullDescriptors);
                    }
                    else
                    {
                        return callback(1, null);
                    }
                });
            }
            else
            {
                const util = require('util');
                console.error("Error fetching most recently filled in descriptors for user " + self.uri);
                return callback(1, descriptors);
            }
        });
};

User.prototype.isAdmin = function(callback)
{
    const self = this;

    if(typeof callback === "function")
    {
        self.checkIfHasPredicateValue("rdf:type", "ddr:Administrator", function(err, isAdmin)
        {
            return callback(err, isAdmin);
        });
    }
    else
    {
        if(_.contains(self.rdf.type, "ddr:Administrator"))
        {
            return true;
        }
        else
        {
            return false;
        }
    }

};

User.prototype.makeGlobalAdmin = function(callback)
{
    const self = this;

    self.isAdmin(function(err, isAdmin){
        if(!err)
        {
            if(!isAdmin)
            {
                const newAdminDescriptor = new Descriptor({
                    prefixedForm: "rdf:type",
                    type: DbConnection.prefixedResource,
                    value: "ddr:Administrator"
                });

                self.insertDescriptors([newAdminDescriptor], function(err, result){
                    if(!err)
                    {
                        return callback(null, self);
                    }
                    else
                    {
                        const msg = "Error setting " + self.uri + " as global admin : " + result;
                        console.error(msg);
                        return callback(1, msg);
                    }

                });
            }
            else
            {
                var msg = "User " + self.uri + " is already an admin, nothing to be done.";
                console.error(msg);
                return callback(0, msg);
            }
        }
        else
        {
            var msg = "Error seeing if "+ self.uri + " is global admin : " + isAdmin;
            console.error(msg);
            return callback(1, msg);
        }
    });
};

User.prototype.undoGlobalAdmin = function(callback)
{
    const self = this;

    self.checkIfHasPredicateValue("rdf:type", "ddr:Administrator", function(err, isAdmin){
        if(!err)
        {
            if (isAdmin)
            {
                self.deleteDescriptorTriples("rdf:type", function(err, result){
                    return callback(err, result);
                }, "ddr:Administrator");
            }
            else
            {
                var msg = "User " + self.uri + " is not admin, no need to remove the triples.";
                console.error(msg);
                return callback(0, msg);
            }
        }
        else
        {
            var msg = "Error seeing if "+ self.uri + " is global admin : " + isAdmin;
            console.error(msg);
            return callback(1, msg);
        }
    })
};

User.prototype.finishPasswordReset = function(newPassword, token, callback)
{
    const self = this;

    self.checkIfHasPredicateValue("ddr:password_reset_token", token, function(err, tokenIsCorrect)
    {
        if(!err)
        {
            if(tokenIsCorrect)
            {
                const crypto = require('crypto'), shasum = crypto.createHash('sha1');

                shasum.update(newPassword);
                self.ddr.password = shasum.digest('hex');
                self.ddr.password_reset_token = null;

                self.save(function(err, result){
                    if(!err)
                    {
                        console.log("Successfully set new password for user : " + self.uri + ".");
                        return callback(err, result);
                    }
                    else
                    {
                        console.error("Error setting new password for user : " + self.uri + ". Error reported: " + result);
                        return callback(err, result);
                    }
                });
            }
            else
            {
                return callback(1, "Incorrect password reset token");
            }
        }
        else
        {
            return callback(1, "Error checking password reset token: " + tokenIsCorrect);
        }
    });
};

User.prototype.startPasswordReset = function(callback)
{
    const self = this;
    const uuid = require('uuid');

    const token = uuid.v4();

    self.ddr.password_reset_token = token;

    const sendConfirmationEmail = function (callback) {
        const nodemailer = require('nodemailer');

        // create reusable transporter object using the default SMTP transport

        const gmailUsername = Config.email.gmail.username;
        const gmailPassword = Config.email.gmail.password;

        const ejs = require('ejs');
        const fs = require('fs');


        const appDir = path.dirname(require.main.filename);

        const emailHTMLFilePath = Config.absPathInSrcFolder('views/users/password_reset_email.ejs');
        const emailTXTFilePath = path.join(appDir, 'views/users/password_reset_email_txt.ejs');

        const file = fs.readFileSync(emailHTMLFilePath, 'ascii');
        const fileTXT = fs.readFileSync(emailTXTFilePath, 'ascii');

        const rendered = ejs.render(file, {
            locals: {
                'user': self,
                'url': Config.baseUri,
                token: token,
                email: self.foaf.mbox
            }
        });
        const renderedTXT = ejs.render(fileTXT, {
            locals: {
                'user': self,
                'url': Config.baseUri,
                token: token,
                email: self.foaf.mbox
            }
        });

        const mailer = require("nodemailer");

        // Use Smtp Protocol to send Email
        const smtpTransport = mailer.createTransport("SMTP", {
            service: "Gmail",
            auth: {
                user: gmailUsername + "@gmail.com",
                pass: gmailPassword
            }
        });

        const mail = {
            from: "Dendro RDM Platform <from@gmail.com>",
            to: self.foaf.mbox + "@gmail.com",
            subject: "Dendro Website password reset instructions",
            text: renderedTXT,
            html: rendered
        };

        smtpTransport.sendMail(mail, function (error, response) {
            if (error) {
                console.err(error);
            }
            else {
                console.log('Password reset sent to ' + self.foaf.mbox + 'Message sent: ' + JSON.stringify(response));
            }

            smtpTransport.close();
            return callback(error, response);
        });
    };

    self.save(function(err, updatedUser){
        if(!err)
        {
            sendConfirmationEmail(callback)
        }
        else
        {
            console.error("Unable to set password reset token for user " + self.uri);
            return callback(err, updatedUser);
        }
    });
};

User.prototype.getAvatarUri = function () {
    var self = this;
    if(self.ddr.hasAvatar)
    {
        return self.ddr.hasAvatar;
    }
    else
    {
        var msg = "User has no previously saved Avatar";
        console.error(msg);
        return null;
    }
};

User.removeAllAdmins = function(callback)
{
    const adminDescriptor = new Descriptor({
        prefixedForm: "rdf:type",
        value: "ddr:Administrator"
    });

    Resource.deleteAllWithCertainDescriptorValueAndTheirOutgoingTriples(adminDescriptor, function(err, results)
    {
        if (!err)
        {
            return callback(0, results);
        }
        else
        {
            const msg = "Error deleting all administrators: " + results;
            console.error(msg);
            return callback(1, msg);
        }
    });
};

User.anonymous = {
    uri: "http://dendro.fe.up.pt/user/anonymous"
};

User.prefixedRDFType = "ddr:User";

User = Class.extend(User, Resource);

module.exports.User = User;
