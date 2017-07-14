var chatRemote = require('../remote/chatRemote');
var Utils = require('../../../../util/utils');
module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
};

var handler = Handler.prototype;

/**
 * Send messages to users
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
handler.send = function (msg, session, next) {
    var channelService = this.app.get('channelService');
    var message = msg.content;

    var users = msg.receivers;
    console.log(users)
    var receives = [];
    for (var i = 0; i < users.length; i++) {
        try{
            var param = {};
            channel = channelService.getChannel("home", false);
            param.uid = users[i].userName + '*' + "home";
            param.sid = channel.getMember(param.uid)['sid'];
            receives.push(param);
        }catch(err){
            continue;
        }
    }
    console.log(receives)
    if(receives.length==0){
        next(null, {
            route: msg.route
        })
        return;
    }
    channelService.pushMessageByUids('onChat', message, receives, function (err, users) {
        console.log(err)
        console.log(JSON.stringify(users))//发送失败的用户
    });
    next(null, {
        route: msg.route
    });
};
