#!/usr/bin/env bash
export LD_LIBRARY_PATH=/home/v3/lib/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH
mkdir -p /home/v3/Documents/Lira/data
exec /home/v3/redis8/usr/bin/redis-server --bind 127.0.0.1 --port 6379 --dir /home/v3/Documents/Lira/data
