var chatRemote = require('../remote/chatRemote');
var Utils = require('../../../util/utils');
var redis = require('../../../redis/connect');
Date.prototype.Format = function (fmt) { //author: meizz
    var o = {
        "M+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日
        "h+": this.getHours(), //小时
        "m+": this.getMinutes(), //分
        "s+": this.getSeconds(), //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}
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
    if (msg.room) {
        for (var i = 0; i < users.length; i++) {
            var m = i;//因为下面是异步的方法，var定义的i变化不是我们想要的变量的值，应该使用let,但let是es6的语法
            redis.hget(users[m], msg.roomInfo.roomName, function (err, data) {
                var messages = [];
                if (data) {
                    messages = JSON.parse(data).concat(message);
                    redis.hset(users[m], msg.roomInfo.roomName, JSON.stringify(messages), redis.print);
                } else {
                    redis.hset(users[m], msg.roomInfo.roomName, JSON.stringify(message), redis.print);
                }
            });

            //chatList信息.接收方
            redis.hget(users[m] + ":recent", msg.roomInfo.roomName, function (err, data) {
                var user = msg.roomInfo;
                if (data) {
                    user["unreadCount"] = JSON.parse(data).unreadCount + 1;
                } else {
                    user["unreadCount"] = 1;
                }
                if (users[m] == msg.from) {
                    user["unreadCount"] = 0;
                }
                user["time"] = new Date(message[0].createdAt).Format("yyyy-MM-dd hh:mm:ss");
                user["content"] = message[0].text;
                redis.hset(users[m] + ":recent", msg.roomInfo.roomName, JSON.stringify(user), function (err, res) {
                    pushChatListMessage(channelService, users[m]);
                });
            });
        }
    } else {
        for (var i = 0; i < users.length; i++) {
            var m = i;//因为下面是异步的方法，var定义的i变化不是我们想要的变量的值，应该使用let,但let是es6的语法
            //发送消息，记录
            redis.hget(msg.from, users[i].userName, function (err, data) {
                var messages = [];
                if (data) {
                    messages = JSON.parse(data).concat(message);
                    redis.hset(msg.from, users[m].userName, JSON.stringify(messages), redis.print);
                } else {
                    redis.hset(msg.from, users[m].userName, JSON.stringify(message), redis.print);
                }
            });
            redis.hget(users[i].userName, msg.from, function (err, data) {
                var messages = [];
                if (data) {
                    messages = JSON.parse(data).concat(message);
                    redis.hset(users[m].userName, msg.from, JSON.stringify(messages), redis.print);
                } else {
                    redis.hset(users[m].userName, msg.from, JSON.stringify(message), redis.print);
                }
            });
            //chatList信息.接收方
            redis.hget(users[i].userName + ":recent", msg.from, function (err, data) {
                var user = msg.fromInfo;
                if (data) {
                    user["unreadCount"] = JSON.parse(data).unreadCount + 1;
                } else {
                    user["unreadCount"] = 1;
                }
                user["time"] = new Date(message[0].createdAt).Format("yyyy-MM-dd hh:mm:ss");
                user["content"] = message[0].text;
                redis.hset(users[m].userName + ":recent", msg.from, JSON.stringify(user), function (err, res) {
                    pushChatListMessage(channelService, user.userName);
                });
            });
            //chatList信息.发送方
            redis.hget(msg.from + ":recent", users[m].userName, function (err, data) {
                var user = users[m];
                user["unreadCount"] = 0;
                user["time"] = new Date(message[0].createdAt).Format("yyyy-MM-dd hh:mm:ss");
                user["content"] = message[0].text;
                redis.hset(msg.from + ":recent", users[m].userName, JSON.stringify(user), function (err, res) {
                    pushChatListMessage(channelService, user.userName);
                });
            });
        }
    }
    for (var i = 0; i < users.length; i++) {
        try {
            if (msg.room) {
                message[i]["roomName"] = msg.roomInfo.roomName;
                var param = {};
                channel = channelService.getChannel("home", false);
                param.uid = users[i] + '*' + "home";
                param.sid = channel.getMember(param.uid)['sid'];
                receives.push(param);
            }else{
                var param = {};
                channel = channelService.getChannel("home", false);
                param.uid = users[i] + '*' + "home";
                param.sid = channel.getMember(param.uid)['sid'];
                receives.push(param);
            }
        } catch (err) {
            continue;
        }
    }
    console.log("ceshi"+JSON.stringify(receives))
    console.log("ceshi"+JSON.stringify(message))
    console.log(receives)
    if (receives.length == 0) {
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


handler.getMessages = function (msg, session, next) {
    var count = msg.count;
    redis.hget(msg.from, msg.receiver, function (err, data) {
        if (data) {
            var messages = JSON.parse(data);
            var loadMore = false;
            var showMes = [];
            for (var i = messages.length < (20 + count) ? 0 : (messages.length - (20 + count)); i < messages.length - count; i++) {
                showMes.push(messages[i]);
            }
            if (messages.length > (count + 20)) {
                loadMore = true;
            }
            next(null, {
                messages: showMes,
                loadMore: loadMore
            });
        } else {
            redis.hset(msg.from, msg.receiver, JSON.stringify([]), redis.print);
            next(null, {
                messages: [],
                loadMore: false
            });
        }
    });
    var channelService = this.app.get('channelService');
    redis.hget(msg.from + ":recent", msg.receiver, function (err, data) {
        var user = JSON.parse(data);
        if (data) {
            user.unreadCount = 0;
            redis.hset(msg.from + ":recent", msg.receiver, JSON.stringify(user), function (err, res) {
                pushChatListMessage(channelService, msg.from);
            });
        } else {
            return;
        }

    });

};

handler.addFriend = function (msg, session, next) {
    var requets = [];
    redis.hget(msg.receiver, "newFriend", function (err, data) {
        if (data) {
            var news = JSON.parse(data);
            var flag = false;
            for (var i = 0; i < news.length; i++) {
                if (news[i].userName == msg.from) {
                    flag = true;
                    break;
                }
            }
            if (flag) {
                next(null, {
                    requets: [],
                });
                return;
            } else {
                requets = JSON.parse(data).concat([{userName: msg.from, avatar: msg.avatar}]);
                redis.hset(msg.receiver, "newFriend", JSON.stringify(requets), redis.print);
                next(null, {
                    requets: requets,
                });
                pushNewFriendMessage(this, msg);
                return;
            }
        } else {
            requets = [{userName: msg.from, avatar: msg.avatar}];
            redis.hset(msg.receiver, "newFriend", JSON.stringify([{
                userName: msg.from,
                avatar: msg.avatar
            }]), redis.print);
            next(null, {
                requets: requets,
            });
            pushNewFriendMessage(this, msg);
        }
    }.bind(this));

};
function pushNewFriendMessage(context, msg) {
    var channelService = context.app.get('channelService');
    var param = {};
    channel = channelService.getChannel("home", false);
    param.uid = msg.receiver + '*' + "home";
    param.sid = channel.getMember(param.uid)['sid'];
    channelService.pushMessageByUids('onAddFriend', {hasTip: true, userName: msg.from}, [param], function (err, users) {
        console.log(JSON.stringify(users))//发送失败的用户
    });
}

function pushChatListMessage(channelService, name) {
    var param = {};
    channel = channelService.getChannel("home", false);
    param.uid = name + '*' + "home";
    param.sid = channel.getMember(param.uid)['sid'];
    redis.hgetall(name + ":recent", function (err, data) {
        var chatList = [];
        for (var key in data) {
            chatList.push(JSON.parse(data[key]));
        }
        channelService.pushMessageByUids('onRefreshFriend', chatList, [param], function (err, users) {
            console.log(JSON.stringify(users))//发送失败的用户
        });
    });

}
handler.getNewFriend = function (msg, session, next) {
    var requets = [];
    redis.hget(msg.from, "newFriend", function (err, data) {
        console.log(data)
        if (data) {
            var requets = JSON.parse(data);
            next(null, {
                requets: requets,
            });
        } else {
            next(null, {
                requets: [],
            });
        }
    });
};
handler.cleanFriend = function (msg, session, next) {
    var requets = [];
    redis.hget(msg.from, "newFriend", function (err, data) {
        console.log(data)
        if (data) {
            var news = JSON.parse(data);
            for (var i = 0; i < news.length; i++) {
                console.log(news[i].receiver, msg.receiver)
                if (news[i].userName == msg.receiver) {
                    continue;
                }
                requets.push(news[i]);
            }
            redis.hset(msg.from, "newFriend", JSON.stringify(requets), redis.print);
            next(null, {
                requets: requets,
                userName: msg.receiver
            });
        } else {
            next(null, {
                requets: [],
                userName: msg.receiver
            });
        }
    });
};
handler.addRoom = function (msg, session, next) {

};


handler.getChatList = function (msg, session, next) {
    redis.hgetall(msg.from + ":recent", function (err, data) {
        var chatList = [];
        for (var key in data) {
            chatList.push(JSON.parse(data[key]));
        }
        next(null, {
            chatList: chatList
        });
    });
};