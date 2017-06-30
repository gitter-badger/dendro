const Config = function () {
    return global.Config;
}();

const isNull = require(Config.absPathInSrcFolder("/utils/null.js")).isNull;
const Class = require(Config.absPathInSrcFolder("/models/meta/class.js")).Class;
const DbConnection = require(Config.absPathInSrcFolder("/kb/db.js")).DbConnection;
const Resource = require(Config.absPathInSrcFolder("/models/resource.js")).Resource;
const Descriptor = require(Config.absPathInSrcFolder("/models/meta/descriptor.js")).Descriptor;

const db = function () {
    return global.db.default;
}();

const async = require('async');

function Change (object)
{
    Change.baseConstructor.call(this, object, Change);
    const self = this;

    self.copyOrInitDescriptors(object);

    const now = new Date();
    self.dcterms.created = now.toISOString();

    if(isNull(self.uri))
    {
        const uuid = require('uuid');
        self.uri = "/r/change/" + uuid.v4();
    }

    return self;
}

Change.findByAssociatedRevision = function(revisionUri, callback)
{
    const query =
        "WITH [0] \n" +
        "SELECT ?uri \n" +
        "WHERE { \n" +
        "?uri rdf:type ddr:Change . \n" +
        "?uri ddr:pertainsTo [1] . \n" +
        "} \n";

    db.connection.execute(query,
        [
            {
                type : DbConnection.resourceNoEscape,
                value : db.graphUri
            },
            {
                type : DbConnection.resource,
                value : revisionUri
            }
        ],
        function(err, results) {
            if(!err)
            {
                const fetchFullChange = function (changeResultRow, cb) {
                    Change.findByUri(changeResultRow.uri, function (err, change) {
                        if (!err) {
                            cb(null, change);
                        }
                        else {
                            cb(1, null);
                        }
                    });
                };

                async.map(results, fetchFullChange, function(err, fullChanges){
                    if(!err)
                    {
                        return callback(null, fullChanges);
                    }
                    else
                    {
                        return callback(1, "Error fetching full changes of the revision " + revisionUri);
                    }
                });
            }
            else
            {
                return callback(1, "Unable to fetch all changes for resource " + revisionUri);
            }
        });
};

/*Change.prototype.save = function(callback)
{
    var self = this;
    var changedDescriptor = new Descriptor({
        uri : self.ddr.changedDescriptor
    });

    //changes on audit-only descriptors are not meant to be recorded as such,
    // as they are automatically managed and created by the system
    if(!changedDescriptor.audit)
    {
        self.baseConstructor.save(callback);
    }
    else
    {
        console.error("Attempt to record a change on a locked descriptor. debug please. ");
        return callback(0, null);
    }
}*/

Change = Class.extend(Change, Resource, "ddr:Change");

module.exports.Change = Change;