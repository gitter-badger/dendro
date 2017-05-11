#!/usr/bin/env bash

mysql_database_to_create=$1
mysql_username=$2
mysql_root_password=$3

#install NVM, Node 6.10, Node Automatic Version switcher
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.1/install.sh | bash &&
export NVM_DIR="$HOME/.nvm" &&
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

export COVERALLS_SERVICE_NAME="Jenkins"
export COVERALLS_REPO_TOKEN="kVeT2pSFVWDEoZCC5xN6wCS1j8YRaiG5e"
export RUNNING_IN_JENKINS="1"

echo "create database ${mysql_database_to_create};" | mysql -u $mysql_username -p$mysql_root_password

npm run test || echo "Tests FAILED! Trying to report coverage anyway!"
#npm run coverage > /dev/null
env COVERALLS_SERVICE_NAME="Jenkins" COVERALLS_REPO_TOKEN="kVeT2pSFVWDEoZCC5xN6wCS1j8YRaiG5e" RUNNING_IN_JENKINS="1" npm run report-coverage || echo "Failed to calculate coverage!"
