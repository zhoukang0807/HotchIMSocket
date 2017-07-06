var chatRemote = require('../remote/chatRemote');
var Utils = require('../../../../util/utils');
module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
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
handler.send = function(msg, session, next) {
	var rid = msg.rid;
	console.log(session.uid)
	var username = session.uid.split('*')[0];
	var channelService = this.app.get('channelService');
	var param = msg.content;
	channel = channelService.getChannel(rid, false);

	//the target is all users
	if(msg.target == '*') {
		channel.pushMessage('onChat', param);
	}
	//the target is specific user
	else {
		var tuid = msg.target + '*' + rid;
		var tsid = channel.getMember(tuid)['sid'];
		channelService.pushMessageByUids('onChat', param, [{
			uid: tuid,
			sid: tsid
		}],function (err,users) {
            console.log(err)
               console.log(JSON.stringify(users))//发送失败的用户
        });
	}
	next(null, {
		route: msg.route
	});
};