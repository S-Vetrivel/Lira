#!/usr/bin/env bash
export LD_LIBRARY_PATH=/home/v3/lib/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH
mkdir -p /home/v3/Documents/Lira/data/db
exec /home/v3/.cache/mongodb-binaries/mongod-x64-ubuntu-4.4.29 --dbpath /home/v3/Documents/Lira/data/db --bind_ip 127.0.0.1 --port 27017
