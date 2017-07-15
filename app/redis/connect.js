var redis = require("redis")//召唤redis
var redisConfig = require("../../config/ipconfig.json"),//召唤redis

client = redis.createClient(redisConfig.redis.port,redisConfig.redis.ip,{});

client.on("error", function (err) {
    console.log("Error " + err);
});
module.exports = client;