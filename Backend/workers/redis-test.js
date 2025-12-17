const Redis = require("ioredis");

const redis = new Redis(
  "rediss://:zOTHvixcnOhncPBRfH15j9WtnFbq5RbD@redis-15874.c10.us-east-1-2.ec2.cloud.redislabs.com:15874",
  {
    tls: {
      servername: "redis-15874.c10.us-east-1-2.ec2.cloud.redislabs.com",
    },
  }
);

redis
  .set("ping", "pong")
  .then(() => redis.get("ping"))
  .then(console.log)
  .catch(console.error);
