var apiRoot = window.localStorage.getItem('server');
if (!apiRoot) {
  apiRoot = 'http://127.0.0.1:7901';
}

var websocket, timer;
var touchSupported = 'ontouchstart' in window,
  mousedownEvent = 'mousedown' + ( touchSupported ? ' touchstart' : ''),
  mousemoveEvent = 'mousemove' + ( touchSupported ? ' touchmove' : ''),
  mouseupEvent = 'mouseup' + ( touchSupported ? ' touchend' : '');
var offset = function (obj) {
  var ret = {left: 0, top: 0};
  do {
    ret.left += obj.offsetLeft;
    ret.top += obj.offsetTop;
  } while (obj = obj.offsetParent);

  return ret;
};
var preloadImage = function (src) {
  var photo = new Image();
  photo.src = apiRoot + src;
};
var $el = function (id) {
  return document.getElementById(id);
};

angular.module('voteApp', ['ionic'], ['$httpProvider', function($httpProvider) {
    // Use x-www-form-urlencoded Content-Type
    $httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';

    /**
     * The workhorse; converts an object to x-www-form-urlencoded serialization.
     * @param {Object} obj
     * @return {String}
     */
    var param = function(obj) {
      var query = '', name, value, fullSubName, subName, subValue, innerObj, i;

      for(name in obj) {
        value = obj[name];

        if(value instanceof Array) {
          for(i=0; i<value.length; ++i) {
            subValue = value[i];
            fullSubName = name + '[' + i + ']';
            innerObj = {};
            innerObj[fullSubName] = subValue;
            query += param(innerObj) + '&';
          }
        }
        else if(value instanceof Object) {
          for(subName in value) {
            subValue = value[subName];
            fullSubName = name + '[' + subName + ']';
            innerObj = {};
            innerObj[fullSubName] = subValue;
            query += param(innerObj) + '&';
          }
        }
        else if(value !== undefined && value !== null)
          query += encodeURIComponent(name) + '=' + encodeURIComponent(value) + '&';
      }

      return query.length ? query.substr(0, query.length - 1) : query;
    };

    // Override $http service's default transformRequest
    $httpProvider.defaults.transformRequest = [function(data) {
      return angular.isObject(data) && String(data) !== '[object File]' ? param(data) : data;
    }];
  }])
  .filter('apiUrl', function () {
    return function (url) {
      return apiRoot + url;
    }
  })
  .filter('voteStyle', function () {
    return function (score, type) {
      score = parseInt(score);
      if (isNaN(score)) score = 0;

      if (score > 100)
        score = 100;
      if (score < 0)
        score = 0;

      if (type == 0) // result
        return score;

      if (type == 3) // pointer
        return '-webkit-transform:rotate('+(score * 3.6)+'deg);transform:rotate('+(score * 3.6)+'deg);';

      if (score == 0) {
        if (type == 1) { // left
          return '-webkit-transform:rotate(180deg);transform:rotate(180deg);opacity:0;';
        } else { // right
          return '-webkit-transform:rotate(0deg);transform:rotate(0deg);opacity:0;'
        }
      } else if (score <= 50) {
        if (type == 1) { // left
          return '-webkit-transform:rotate(180deg);transform:rotate(180deg);opacity:0;'
        } else { // right
          return '-webkit-transform:rotate('+(score * 3.6)+'deg);transform:rotate('+(score * 3.6)+'deg);opacity:1;'
        }
      } else {
        if (type == 1) { // left
          return '-webkit-transform:rotate('+(score * 3.6)+'deg);transform:rotate('+(score * 3.6)+'deg);opacity:1;';
        } else { // right
          return '-webkit-transform:rotate(180deg);transform:rotate(180deg);opacity:1;'
        }
      }
    }
  })
  .filter('printScore', function () {
    return function (score) {
      if (score == -1)
        return '未评分';
      if (score == -2)
        return '已评分';

      return score + ' 分';
    }
  })
  .directive('voteControl', ['$document', function ($document) {
    return {
      restrict: 'E',
      templateUrl: 'vote-control.html',
      scope: {
        result: '='
      },
      link: function (scope, element, attr) {
        if (!scope.result) scope.result = { enabled: true, score: 80 };
        var x0, y0, size, touchOnly = false;

        element.addClass('vote-control');
        element.on(mousedownEvent, function (event) {
          if (!scope.result.enabled)
            return;

          if (!touchOnly && /^touch/.test(event.type)) {
            touchOnly = true;
            console.log('Touch event detected! Remove mouse event handler.');

            $document.off('mousedown');
            mousedownEvent = 'touchstart';
            mousemoveEvent = 'touchmove';
            //mouseupEvent = 'touchend';
          }

          var off = offset(element[0]);

          size = element[0].offsetHeight;
          x0 = off.left + size / 2;
          y0 = off.top + size / 2;

          mousemove(event);
          $document.on(mousemoveEvent, mousemove);
          $document.on(mouseupEvent, mouseup);
        });

        var mousemove = function (event) {
          var isTouch = /^touch/.test(event.type);
          if (touchOnly && !isTouch)
            return;

          var x = (isTouch ? event.touches[0] : event).pageX - x0,
            y = y0 - (isTouch ? event.touches[0] : event).pageY,
            rad;

          if (x * x + y * y < 4900)
            return;

          rad = Math.atan2(x, y);
          if (rad < 0) {
            rad = Math.PI * 2 + rad;
          }

          var newScore = Math.round(rad / 2 / Math.PI * 100);
          var oldScore = parseInt(scope.result.score);

          //console.log(event, x, y, x * x + y * y, newScore, oldScore);

          if (!isNaN(oldScore)) {
            if (oldScore > 80 && newScore < 20)
              newScore = 100;
            if (oldScore < 20 && newScore > 80)
              newScore = 0;
          }

          scope.$apply(function () {
            scope.result.score = newScore;
          });
        };

        var mouseup = function (event) {
          $document.off(mousemoveEvent, mousemove);
          $document.off(mouseupEvent, mouseup);
        };
      }
    }
  }])
  .controller('LoginCtrl', ['$scope', '$http', '$ionicPopup', '$ionicLoading', '$state', '$timeout', function($scope, $http, $ionicPopup, $ionicLoading, $state, $timeout) {
    $scope.login = {};
    $scope.login.server = apiRoot;
    $scope.deviceId = 'Unknown';

    $scope.goIndex = function () {
      $state.go('index');
    };
    $scope.acquireToken = function (d) {
      $ionicPopup.confirm({
        title: '确认导入',
        template: '您确定要导入 <span class="positive">'+d.nickname+' (登录名：'+d.username+')</span> 的凭据吗？',
        okText: '确定',
        cancelText: '取消'
      }).then(function(res) {
        if(res) {
          $ionicLoading.show({
            template: 'Loading...'
          });

          $http.post(apiRoot + '/acquire', {
            id: d.id,
            token: $scope.token,
            device: $scope.deviceId,
            cookie: $scope.cookie
          }).then(function successCallback(response) {
            $ionicLoading.hide();
            if (response.data.error) {
              $ionicPopup.alert({
                title: '提示信息',
                template: response.data.error,
                okText: '确定'
              });
            } else {
              window.localStorage.setItem('cookie', response.data.id + '|' + response.data.token);
              return $scope.goIndex();
            }
          }, function errorCallback(response) {
            $ionicLoading.hide();
            return $ionicPopup.alert({
              title: '提示信息',
              template: '登录失败，请稍后再试',
              okText: '确定'
            });
          });
        }
      });
    };

    $scope.formSubmit = function () {
      if (!$scope.login.username || !$scope.login.password || !$scope.login.server) {
        return $ionicPopup.alert({
          title: '提示信息',
          template: '请将表单填写完整',
          okText: '确定'
        });
      }

      $ionicLoading.show({
        template: '正在提交 ...'
      });

      $http.post($scope.login.server + '/login?app=1', {
        un: $scope.login.username,
        pw: Sha256.hash($scope.login.username + '>/<' + Sha256.hash($scope.login.password) + '><' + $scope.login.username)
      }).then(function successCallback(response) {
        if (response.data.error) {
          $ionicPopup.alert({
            title: '提示信息',
            template: response.data.error,
            okText: '确定'
          });
        } else {
          apiRoot = $scope.login.server;

          try {
            var device = cordova.require('cordova-plugin-device.device');
            $scope.deviceId = device.uuid;
          }
          catch (e) {
            $scope.deviceId = 'Unknown';
          }

          window.localStorage.setItem('server', apiRoot);

          $scope.login.id = response.data.id;
          $scope.token = response.data.token;
          $scope.cookie = response.data.cookie;
          $scope.list = response.data.list;
        }
        $ionicLoading.hide();
      }, function errorCallback(response) {
        $ionicLoading.hide();
        return $ionicPopup.alert({
          title: '提示信息',
          template: '登录失败，请稍后再试',
          okText: '确定'
        });
      });
    }
  }])
  .controller('IndexCtrl', ['$scope', '$state', '$ionicPopup', '$ionicLoading', '$timeout', '$sce', function($scope, $state, $ionicPopup, $ionicLoading, $timeout, $sce) {
    window.indexScope = $scope;

    var wsToken = window.localStorage.getItem('cookie');

    var wsUri = apiRoot.replace('http', 'ws');
    var controlLock = false;
    $scope.local = {
      connected: false,
      step: -1,
      votingId: 0,
      pendingScore: {
        score: 0
      },
      history: '100vw'
    };

    var $el_toggler = $el('vote-history-toggler');
    var $el_cover = $el('vote-history-cover');
    var $el_history = $el('vote-history');
    var $el_wrap = $el('vote-wrap');
    var $el_status = false;

    var $el_toggle = function (show) {
      if (!show)
        show = $el_status ? 'off' : 'on';

      if (show == 'on') {
        console.log('Sidebar - on fired');

        $el_status = true;
        $el_history.style.webkitTransform = 'translate(-25vw,0)';
        $el_toggler.style.webkitTransform = 'rotate(180deg)';
        $el_toggler.style.color = '#ffffff';
        $el_cover.style.display = 'block';
        //$el_wrap.style.webkitFilter = 'blur(5px)';
        setTimeout(function () {
          if ($el_status == true)
            $el_cover.style.opacity = 1;
        }, 10);
      } else {
        console.log('Sidebar - off fired');

        $el_status = false;
        $el_history.style.webkitTransform = 'translate(0vw,0)';
        $el_toggler.style.webkitTransform = 'rotate(0deg)';
        $el_toggler.style.color = '#181818';
        $el_cover.style.opacity = 0;
        //$el_wrap.style.webkitFilter = '';
        setTimeout(function () {
          if ($el_status == false)
            $el_cover.style.display = 'none';
        }, 410);
      }
    };
    angular.element($el_toggler).on('click', function () {
      $el_toggle();
    });
    angular.element($el_cover).on('click', function () {
      $el_toggle('off');
    });


    $scope.showVote = function (p) {
      if (p.score != -1) return;

      $scope.local.votingId = p.id;
      $scope.local.pendingScore.enabled = false;
      $scope.local.pendingScore.score = 80;

      setTimeout(function () {
        $scope.local.pendingScore.enabled = true;
      }, 800);
    };
    $scope.submitScore = function () {
      if (controlLock) return;
      var vId = $scope.local.votingId, vScore = $scope.local.pendingScore.score;

      if (!$scope.votingList) return;
      var index = indexInArray($scope.votingList, vId, 'id');
      if (index < 0) {
        $scope.local.votingId = 0;
        return $ionicPopup.alert({
          title: '提示信息',
          template: '不能对这个选手评分',
          okText: '确定'
        });
      }

      $ionicPopup.confirm({
        title: '确认评分',
        template: '您确定要对选手 <span class="positive">'+$scope.votingList[index].no+' 号</span> 评分 <span class="positive">'+vScore+'</span> 吗？',
        okText: '确定',
        cancelText: '我再想想'
      }).then(function(res) {
        if (res) {
          if (controlLock) return;

          websocket.send('D' + vId + '|' + vScore);
          controlLock = true;
          $scope.local.votingId = 0;
          $ionicLoading.show({
            template: 'Loading...'
          });

          setTimeout(function () {
            if (controlLock) {
              $ionicLoading.hide();
              controlLock = false;
            }
          }, 5000);
        }
      });
    };
    $scope.goLogin = function () {
      $state.go('login');
    };
    $scope.goReload = function () {
      window.location.reload();
    };
    $scope.loadPlay = function (play) {
      $ionicPopup.confirm({
        title: '请确认',
        template: '您确定要进入比赛 <span class="positive">'+play.name+'</span> 吗？',
        okText: '确定',
        cancelText: '我再想想'
      }).then(function(res) {
        if (res) {
          if (controlLock) return;

          websocket.send('@' + play.id);
          controlLock = true;

          $ionicLoading.show({
            template: 'Loading...'
          });

          setTimeout(function () {
            if (controlLock) {
              $ionicLoading.hide();
              controlLock = false;
            }
          }, 5000);
        }
      });
    };

    function init() {
      if (websocket) {
        websocket.close(4201, '尝试重新连接');
      }
      websocket = new WebSocket(wsUri);
      websocket.onopen = function (evt) {
        websocket.send('A' + wsToken);
      };
      websocket.onclose = function (evt) {
        websocket = null;
        $scope.$apply(function () {
          $scope.local.connected = false;
          if ($scope.playList)
            $scope.playList.length = 0;
        });

        console.log("DISCONNECTED", evt.code, evt.reason);
        if (evt.code == 4101 || evt.code == 4109) {
          // 需要重新授权
          window.localStorage.removeItem('cookie');
          return $ionicPopup.alert({
            title: '与服务器的连接断开',
            template: '与服务器的连接断开 ('+evt.code+')<br>' + evt.reason,
            okText: '确定'
          });
        }

        if (timer) {
          clearTimeout(timer);
          timer = null;
        }

        $ionicPopup.alert({
          title: '与服务器的连接断开',
          template: '与服务器的连接断开 ('+evt.code+')<br>' + evt.reason + (evt.code == 1006 ? '<br><br>请与技术人员取得联系' : ''),
          okText: '确定'
        });
      };
      websocket.onmessage = function (evt) {
        $scope.$apply(function () {
          onMessage(evt)
        });
      };
      websocket.onerror = function (evt) {
        console.log('%cERROR: ' + evt.data, 'color: red;');
        $ionicPopup.alert({
          title: '错误',
          template: '发生错误<br>'+evt.data+'<br><br>请与技术人员取得联系',
          okText: '确定'
        });
      };
    }

    var indexInArray = function (arr, item, key) {
      var i;
      if (key) {
        for (i = 0; i < arr.length; i++) {
          if (arr[i][key] == item) return i;
        }
      } else {
        for (i = 0; i < arr.length; i++) {
          if (arr[i] == item) return i;
        }
      }
      return -1;
    };

    var playerNo = function (player, index) {
      if ($scope.local.step >= 0 && $scope.live.procedure[$scope.local.step] && $scope.live.procedure[$scope.local.step].no != -1) {
        return player.no.split(',')[$scope.live.procedure[$scope.local.step].no];
      } else {
        return index + 1;
      }
    };

    var makeHistory = function () {
      $scope.historyList = [];
      for (var i = 0; i < $scope.playerList.length; i++) {
        $scope.historyList[i] = {
          id: $scope.playerList[i].id,
          no: playerNo($scope.playerList[i], i),
          score: $scope.scoreList[$scope.local.step][i]
        };
      }

      $scope.historyList.sort(function (a, b) {
        if (a.no == b.no)
          return 0;

        return a.no > b.no ? 1 : -1;
      });
    };

    function keepAlive() {
      websocket.send('0');
      timer = setTimeout(keepAlive, 30000);
    }

    function onMessage(evt) {
      var dataType = evt.data.charAt(0), _data, index, i;
      if (dataType == '0')
        return; // Pong

      if (dataType == 'A') {
        _data = JSON.parse(evt.data.substr(1));
        $scope.local.user = _data.shift();
        $scope.playList = _data;
        keepAlive();
        return;
      }

      if (dataType == 'B') {
        $scope.local.connected = true;
        $scope.playList.length = 0;
        if (controlLock) {
          $ionicLoading.hide();
          controlLock = false;
        }

        _data = JSON.parse(evt.data.substr(1));

        index = -1;
        for (i = 0; i < _data.procedure.length; i++) {
          _data.procedure[i].index = i;
          if (_data.procedure[i].type == 1) {
            _data.procedure[i].no = ++index;
          } else {
            _data.procedure[i].no = -1;
          }
        }

        _data.name = $sce.trustAsHtml(_data.name.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'));
        $scope.live = _data;
        return;
      }

      if (dataType == 'C') {
        if (controlLock) {
          $ionicLoading.hide();
          controlLock = false;
        }

        _data = JSON.parse(evt.data.substr(1));
        if ($scope.live.procedure[_data.step].no == -1) // no need for vote
          return;

        i = false; // using i to mark updateHistory
        if ($scope.local.step != _data.step) {
          $scope.local.step = _data.step;
          i = true;
        }

        var bindPlayer = function (id, updateHistory) {
          if (!$scope.playerList || !$scope.scoreList) {
            console.log('playerList or scoreList not set, wait 1s.');
            return setTimeout(function () {
              $scope.$apply(function () {
                bindPlayer(id, updateHistory);
              });
            }, 1000);
          }

          var data = [];
          for (i = 0; i < id.length; i++) {
            index = indexInArray($scope.playerList, id[i], 'id');
            if (index >= 0) {
              data[i] = {
                id: $scope.playerList[index].id,
                photo: $scope.playerList[index].photo,
                no: playerNo($scope.playerList[index], index),
                score: $scope.scoreList[$scope.local.step][index]
              };
            } else {
              data[i] = {
                no: -1,
                photo: '/notfound.jpg',
                id: id[i],
                score: -1
              };
            }
          }
          $scope.votingList = data;
          if (updateHistory) {
            makeHistory();
          }
        };

        bindPlayer(_data.id, i);
        $scope.local.votingId = 0;
        return;
      }

      if (dataType == 'D') {
        if (controlLock) {
          $ionicLoading.hide();
          controlLock = false;
        }

        _data = evt.data.substr(1).split('|');
        _data[1] = parseInt(_data[1]);

        if (_data[1] == -2) {
          $ionicPopup.alert({
            title: '提示信息',
            template: '您已经评过分，不能重复评分',
            okText: '确定'
          });
        } else {
          index = indexInArray($scope.votingList, _data[0], 'id');
          if (index >= 0)
            $scope.votingList[index].score = _data[1];

          index = indexInArray($scope.playerList, _data[0], 'id');
          if (index >= 0)
            $scope.scoreList[_data[2]][index] = _data[1];

          index = indexInArray($scope.historyList, _data[0], 'id');
          if (index >= 0)
            $scope.historyList[index].score = _data[1];
        }
        return;
      }

      if (dataType == 'E') {
        _data = JSON.parse(evt.data.substr(1));
        $scope.scoreList = _data;
        return;
      }

      if (dataType == 'G') {
        _data = JSON.parse(evt.data.substr(1));
        $scope.playerList = _data;

        // photo preloading
        for (i = 0; i < _data.length; i++) {
          preloadImage(_data[i].photo);
        }
        return;
      }

      if (dataType == 'H') {
        _data = evt.data.substr(1).split('|');
        for (i = 0; i < _data.length; i++) {
          index = indexInArray($scope.votingList, _data[i], 'id');
          if (index >= 0) {
            $scope.votingList[index].score = -1;
          }
        }
        return;
      }

      if (dataType == '*') {
        if (controlLock) {
          $ionicLoading.hide();
          controlLock = false;
        }

        return $ionicPopup.alert({
          title: '提示信息',
          template: evt.data.substr(1),
          okText: '确定'
        });
      }

      console.log('%cRESPONSE: ' + evt.data, 'color: blue;');
    }

    $scope.init = init;

    if (!wsToken) {
      return $ionicPopup.alert({
        title: '提示信息',
        template: '此设备尚未登录，请联系技术人员',
        okText: '确定'
      });
    } else {
      init();
    }
  }])
  .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/');

    $stateProvider.state('index', {
      url: '/',
      templateUrl: 'index.html',
      controller: 'IndexCtrl'
    });

    $stateProvider.state('login', {
      url: '/login',
      templateUrl: 'login.html',
      controller: 'LoginCtrl'
    });
  }])
  .run(['$ionicConfig', function($ionicConfig) {
    $ionicConfig.views.swipeBackEnabled(false);
    /*
    $ionicPlatform.ready(function() {
      try {
        var keyboard = cordova.require('cordova-plugin-keyboard.keyboard');
        keyboard.disableScrollingInShrinkView(true);
      }
      catch (e) {

      }
    });*/
  }]);
