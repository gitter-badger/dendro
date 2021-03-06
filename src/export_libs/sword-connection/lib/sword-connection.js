/**
 * Created by Filipe on 09/07/2014.
 */
const jarPath = './export_libs/sword-connection/sword2-client.jar'; //attention with this path, relative path from the root project

function SwordConnection(user, password, serviceDocumentRef){
    const newConnection = Object.create(SwordConnection);
    newConnection.user = user;
    newConnection.password = password;
    newConnection.serviceDocRef = serviceDocumentRef;

    return newConnection;
}
executeCommand = function(command,callback){
    const exec = require('child_process').exec;

    const child = exec(command, function (error, stdout, stderr) {
        if (error) {
            return callback(true, stderr, null);
        } else {
            const data = JSON.parse(stdout);

            if (data.success === 'true') {
                return callback(false, data.message, data.response);
            }
            else {
                if ('message' in data) {
                    return callback(true, data.message, null);
                }
                else {
                    return callback(true, null, null);
                }

            }
        }
    });
};
SwordConnection.listCollections = function(callback){

    const option = "list-collections";
    const command = "java -jar " + jarPath + " " + option + " " + "sword" + " " + this.user + " " + this.password + " " + this.serviceDocRef;

    executeCommand(command,callback);
};
SwordConnection.sendFile = function(repositoryType, filePath,collectionRef,sendMetadata,metadataJsonRef,callback){
    const option = "send-file";
    let command = "java -jar " + jarPath + " " + option + " " + repositoryType + " " + this.user + " " + this.password + " " + this.serviceDocRef;
    command += " " + filePath + " " + collectionRef + " " + sendMetadata;
    if(sendMetadata)
        command += " " + metadataJsonRef;
    executeCommand(command,callback);
};
module.exports.SwordConnection = SwordConnection;