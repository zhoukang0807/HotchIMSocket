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
	var rid = session.get('rid');
	console.log(session.uid)
	var username = session.uid.split('*')[0];
	var channelService = this.app.get('channelService');
	var param = msg.content._id?msg.content:{
        _id: Number(Date.now().toString()+Utils.GetRandomNum(0,1000).toString()),
        text: msg.content,
        createdAt: new Date(),
        user: {
            _id: Number(Date.now().toString()+Utils.GetRandomNum(0,1000).toString()),
            name: username,
            avatar: 'https://facebook.github.io/react/img/logo_og.png',
        }
	};
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
		}]);
	}
	next(null, {
		route: msg.route
	});
};