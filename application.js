/* application */
application = function (options) {
  this.options = {
    className: "application",
    channelCount: 30,
  };
  this.options = aui.lang.merge(this.options, options || {});

  this.className = this.options.className;

  this.pvtDisplayArea = null; // display area
  this.pvtControlArea = null; // control area

  this.pvtControlCount = 1; // max control count
  this.pvtWorkingControlCount = 1; // current control count

  this.pvtControllers = []; // WebAssembly View Controller
  this.pvtControlPanel = null; // control panel

  this.pvtStreamFragment = null; //WebAssembly stream fragment module
  this.pvtFisheyeModule = null; //WebAssembly fisheye module
  this.pvtWebGLAdapterModule = null; // WebAssembly webGL adapter module
  this.pvtUtilityAdapterModule = null;

  this.pvtSessionKey = new Date().getTime() + "u"; // for sync playback
  this.pvtPlayAction = "F"; // F: forward, B: backward

  // Constant
  this.URL_SETTIME =
    "http://{HOSTNAME}:{HTTPPORT}/Media/SyncPlayback/setcurrenttime?syncsession={SESSION}&currenttime={TIME}";
  this.URL_SETMODE =
    "http://{HOSTNAME}:{HTTPPORT}/Media/SyncPlayback/SetPlayMode?syncsession={SESSION}&action={ACTION}&playrate={RATE}";
  this.URL_PLAY =
    "http://{HOSTNAME}:{HTTPPORT}/Media/SyncPlayback/Play?syncsession={SESSION}";
  this.URL_PAUSE =
    "http://{HOSTNAME}:{HTTPPORT}/Media/SyncPlayback/Pause?syncsession={SESSION}";
  this.URL_STEPPREVIOUS =
    "http://{HOSTNAME}:{HTTPPORT}/Media/SyncPlayback/StepPrevious?syncsession={SESSION}";
  this.URL_STEPNEXT =
    "http://{HOSTNAME}:{HTTPPORT}/Media/SyncPlayback/StepNext?syncsession={SESSION}";

  application.superclass.constructor.call(this);
};

aui.lang.Class.extend(application, aui.ui.ControlBase, {
  PATH_WEBASSEMBLY_FRAGMENT_MODULE: "codebase/FragmentModule.wasm",
  PATH_WEBASSEMBLY_FISHEYE_MODULE: "codebase/FisheyeModule.wasm",
  PATH_WEBASSEMBLY_WEBGLADAPTER_MODULE: "codebase/WebGLAdapterModule.wasm",
  PATH_WEBASSEMBLY_UTILITYADAPTER_MODULE: "codebase/UtilityAdapterModule.wasm",
  prepareNode: function (nodeToAppend) {
    var me = this;
    nodeToAppend.className = me.className;

    // initial area
    me.pvtDisplayArea = NewObj("div", "displayarea");
    me.pvtControlArea = NewObj("div", "controlarea");

    nodeToAppend.appendChild(me.pvtDisplayArea);
    nodeToAppend.appendChild(me.pvtControlArea);

    var uiInitialized = false;
    function InitialUI() {
      if (
        !uiInitialized &&
        me.pvtStreamFragment != null &&
        me.pvtFisheyeModule != null &&
        me.pvtWebGLAdapterModule != null &&
        me.pvtUtilityAdapterModule != null
      ) {
        // initial Control Panel
        me.initControlPanel();

        // Utility
        console.log("version = " + me.pvtUtilityAdapterModule.getVersion());
        var code = me.pvtUtilityAdapterModule.dataTranscode(
          "DES_V1_ENC",
          "Aa123456"
        );
        console.log("encode = " + code);
        var str = me.pvtUtilityAdapterModule.dataTranscode("DES_V1_DEC", code);
        console.log("decode = " + str);

        code =
          '<?xml version="1.0" encoding="UTF - 8"?><Message type="Event" Time="1574653185.127" Bias=" - 480" DaylightBias="0"><Event type="Status" srctype="Camera" src="5" id="VideoStatus" port="1" active="on"/></Message>';
        console.log("encode = " + code);
        str = me.pvtUtilityAdapterModule.xmltoJSON(code);
        console.log("decode = " + str);
        var obj = JSON.parse(str);
        console.log(obj);

        // initial WebAssembly
        console.log("initial controller");
        me.initWebAssemblyController();

        uiInitialized = true;
      }
    }

    // fetch WebAssembly Module
    if (typeof WebAssembly === "undefined" || typeof fetch === "undefined") {
      alert("Browser does not support WebAssembly!");
    } else {
      //Fragment
      fetch(me.PATH_WEBASSEMBLY_FRAGMENT_MODULE, { cache: "no-cache" })
        .then(function (response) {
          if (!response["ok"]) {
            alert("Fetch " + me.PATH_WEBASSEMBLY_FRAGMENT_MODULE + " Failed");
          } else {
            return response.arrayBuffer();
          }
        })
        .then(function (buffer) {
          console.log("new WebAssemblyStreamFragment");
          var fragmentMoudle = new aui.nvr.WebAssemblyStreamFragment(buffer);
          fragmentMoudle.onModuleEvent.subscribe(function (type, args) {
            var eventType = args[0] || "";
            var eventArgs = args[1] || null;

            switch (eventType) {
              case "onRuntimeInitialized":
                console.log("frag onRuntimeInitialized");
                me.pvtStreamFragment = fragmentMoudle;
                InitialUI();
                break;
            }
          });
          console.log("initial Fragment");
          Fragment(fragmentMoudle);
        })
        .catch(function (err) {
          //console.error(err);
        });

      //Fisheye
      fetch(me.PATH_WEBASSEMBLY_FISHEYE_MODULE, { cache: "no-cache" })
        .then(function (response) {
          if (!response["ok"]) {
            alert("Fetch " + me.PATH_WEBASSEMBLY_FISHEYE_MODULE + " Failed");
          } else {
            return response.arrayBuffer();
          }
        })
        .then(function (buffer) {
          var fisheyeModule = new aui.nvr.WebAssemblyFisheye(buffer);
          fisheyeModule.onModuleEvent.subscribe(function (type, args) {
            var eventType = args[0] || "";
            var eventArgs = args[1] || null;

            switch (eventType) {
              case "onRuntimeInitialized":
                me.pvtFisheyeModule = fisheyeModule;
                InitialUI();
                break;
            }
          });
          FisheyeModule(fisheyeModule);
        })
        .catch(function (err) {
          //console.error(err);
        });

      //WebGLAdapter
      fetch(me.PATH_WEBASSEMBLY_WEBGLADAPTER_MODULE, { cache: "no-cache" })
        .then(function (response) {
          if (!response["ok"]) {
            alert(
              "Fetch " + me.PATH_WEBASSEMBLY_WEBGLADAPTER_MODULE + " Failed"
            );
          } else {
            return response.arrayBuffer();
          }
        })
        .then(function (buffer) {
          var webGLAdapterModule = new aui.nvr.WebAssemblyWebGLAdapter(buffer);
          webGLAdapterModule.onModuleEvent.subscribe(function (type, args) {
            var eventType = args[0] || "";
            var eventArgs = args[1] || null;

            switch (eventType) {
              case "onRuntimeInitialized":
                me.pvtWebGLAdapterModule = webGLAdapterModule;
                InitialUI();
                break;
            }
          });
          WebGLAdapterModule(webGLAdapterModule);
        })
        .catch(function (err) {
          //console.error(err);
        });

      //UtilityAdapterModule
      fetch(me.PATH_WEBASSEMBLY_UTILITYADAPTER_MODULE, { cache: "no-cache" })
        .then(function (response) {
          if (!response["ok"]) {
            alert(
              "Fetch " + me.PATH_WEBASSEMBLY_UTILITYADAPTER_MODULE + " Failed"
            );
          } else {
            return response.arrayBuffer();
          }
        })
        .then(function (buffer) {
          var Utility = new aui.nvr.WebAssemblyUtilityAdapter(buffer);
          Utility.onModuleEvent.subscribe(function (type, args) {
            var eventType = args[0] || "";
            var eventArgs = args[1] || null;

            switch (eventType) {
              case "onRuntimeInitialized":
                me.pvtUtilityAdapterModule = Utility;
                InitialUI();
                break;
            }
          });
          UtilityModule(Utility);
        })
        .catch(function (err) {
          console.error(err);
        });
    }
  },

  initWebAssemblyController: function () {
    var me = this;

    // WebAssembly Controller
    var initCount = 0;
    for (var i = 0; i < me.pvtControlCount; i++) {
      var eventList = [
        "onchange",
        "onclick",
        "ondblclick",
        "onkeydown",
        "onkeypress",
        "onkeyup",
        "onmousedown",
        "onmousemove",
        "onmouseover",
        "onmouseup",
        "onmouseout",
        "onselect",
        "onsubmit",
        "oncontextmenu",
      ];
      let mdlid = i + 1;
      var fragObject = me.pvtStreamFragment.createFragmentObject(mdlid);
      fragObject.createWorker(
        me.pvtStreamFragment.URL_FRAGWORKER + "?v=" + new Date().getTime()
      ); // set FragWorker.js path
      me.pvtControllers[i] = new aui.nvr.ui.WebAssemblyController({
        object: fragObject,
        sessionKey: me.pvtSessionKey,
        events: eventList,
        id: mdlid,
      });
      me.pvtControllers[i].setWebGLAdapter(me.pvtWebGLAdapterModule);
      me.pvtControllers[i].render(me.pvtDisplayArea);
      me.pvtControllers[i].setWidth(720);
      me.pvtControllers[i].setHeight(540);
      //me.pvtControllers[i].onInitialized.subscribe(function (type, args) {
      //    // WebAssembly prepared!
      //
      //    initCount++;
      //
      //    if (initCount == me.pvtControlCount) {
      //        // Enable Control Panel to control WebAssembly
      //        me.pvtControlPanel.setEnable(true);
      //    }
      //});
      //me.pvtControllers[i].onTimeCallBack.subscribe(function (type, args) {
      //    if (args[0]) {
      //        var time = new Date();
      //        time.setTime(args[0] * 1000);
      //        console.log(aui.lang.Date.format(time, "%Y-%m-%d %H:%i:%s %u"));
      //    }
      //});
      me.pvtControllers[i].onPTZCommand.subscribe(function (type, args) {
        var url = args[0];
        var account = args[1];
        var password = args[2];

        me._sendURLCommand(url, account, password);
      });
      me.pvtControllers[i].onPrintLog.subscribe(function (type, args) {
        me.pvtControlPanel.printLog(args[0]);
      });
    }

    me.pvtControlPanel.setEnable(true);
  },

  initControlPanel: function () {
    var me = this;

    // Control Panel
    me.pvtControlPanel = new aui.nvr.ui.AppControlPanel();
    me.pvtControlPanel.onModeChanged.subscribe(function (type, args) {
      var mode = args[0];

      me.handleModeChanged(mode);
    });
    me.pvtControlPanel.onPlayRateChanged.subscribe(function (type, args) {
      var rate = args[0] || 0;

      me.setPlayRate(rate);
    });
    me.pvtControlPanel.onMousePTZChanged.subscribe(function (type, args) {
      var mode = args[0] || 0;

      me.changePTZModeALL(mode);
    });
    me.pvtControlPanel.onButtonClicked.subscribe(function (type, args) {
      if (!me.pvtControllers) return;
      var btnType = args[0];

      switch (btnType) {
        case "connect":
          me.connectAll();
          break;
        case "disconnect":
          me.disconnectAll();
          break;
        case "mute":
          me.enableAudioInAll(false);
          break;
        case "unmute":
          me.enableAudioInAll(true);
          break;
        case "decodeI":
          me.setDecodeIAll(true);
          break;
        case "noDecodeI":
          me.setDecodeIAll(false);
          break;
        case "resetAudio":
          me.resetAudioAll(false);
          break;
        case "setCurrentTime":
          me.setCurrentTime();
          break;
        case "rewind":
          me.rewind();
          break;
        case "play":
          me.play();
          break;
        case "pause":
          me.pause();
          break;
        case "testCommand":
          me.testCommand();
          break;
      }
    });
    me.pvtControlPanel.onStretchChanged.subscribe(function (type, args) {
      me.changeStretchAll(args[0] == "true");
    });
    me.pvtControlPanel.onChannelChanged.subscribe(function (type, args) {
      var chl = args[0] || 0;

      me.pvtWorkingControlCount = chl;
    });
    me.pvtControlPanel.onFisheyeModuleChanged.subscribe(function (type, args) {
      me.changeFisheyeModuleAll(parseInt(args[0]));
    });
    me.pvtControlPanel.onFisheyeMountingTypeChanged.subscribe(function (
      type,
      args
    ) {
      me.changeFisheyeMountingTypeAll(parseInt(args[0]));
    });
    me.pvtControlPanel.onFisheyeModeChanged.subscribe(function (type, args) {
      me.changeFisheyeModeAll(parseInt(args[0]));
    });
    me.pvtControlPanel.render(me.pvtControlArea);
    me.pvtControlPanel.setEnable(false);
  },

  disconnectAll: function () {
    var me = this;

    for (var i = 0; i < me.pvtControlCount /*me.pvtWorkingControlCount*/; i++) {
      me.pvtControllers[i].disconnect();
    }
  },

  handleModeChanged: function (mode) {
    var me = this;

    me.pvtControlPanel.updateMode(mode);
    for (var i = 0; i < me.pvtWorkingControlCount; i++) {
      me.pvtControllers[i].disconnect();
    }
  },

  connectAll: function () {
    var me = this;
    me.pvtControlPanel.clearPrintLog();
    var data = me.pvtControlPanel.getData();
    var mode = data.mode;

    function connect(controller) {
      function conn() {
        controller.onDisconnect.unsubscribe(conn);
        controller.onConnect.unsubscribeAll();
        controller.onConnect.subscribe(function (type, args) {
          //if (mode == "playback") {
          //    me.setCurrentTime(data);
          //}
        });

        controller.setControlMode(mode);
        controller.setConnectionSettings(data);
        console.log("mode", mode);
        console.log("data", data);
        controller.connect();
      }

      if (controller.getStatus() > 0) {
        controller.onDisconnect.subscribe(conn);
        controller.disconnect();
      } else {
        conn();
      }
    }

    //for (var i = 0; i < me.pvtWorkingControlCount; i++) {
    //    connect(me.pvtControllers[i]);
    //}
    var i = 0;
    var t;
    function slowerConnect() {
      connect(me.pvtControllers[i]);
      i++;
      if (i < me.pvtWorkingControlCount) {
        t = setTimeout(slowerConnect, 5);
      } else {
        clearTimeout(t);
      }
    }
    slowerConnect();

    //me.pvtControllers[0].enableAudioIn(true);
  },

  enableAudioInAll: function (value) {
    var me = this;

    //for (var i = 0; i < me.pvtWorkingControlCount; i++) {
    me.pvtControllers[0].enableAudioIn(value);
    //}
  },

  resetAudioAll: function (value) {
    var me = this;

    //for (var i = 0; i < me.pvtWorkingControlCount; i++) {
    me.pvtControllers[0].setRestart("Audio");
    //}
  },

  setDecodeIAll: function (value) {
    var me = this;

    for (var i = 0; i < me.pvtWorkingControlCount; i++) {
      me.pvtControllers[i].setDecodeI(value);
    }
  },

  changeFisheyeModuleAll: function (value) {
    var me = this;
    ////force webGL canvas
    //if (value == -1) {
    //    for (var i = 0; i < me.pvtWorkingControlCount; i++) {
    //        me.pvtControllers[i].removeFisheyeObject();
    //    }
    //} else
    {
      for (var i = 0; i < me.pvtControlCount; i++) {
        me.pvtControllers[i].setFisheyeObject(
          me.pvtFisheyeModule.createFishEyeObject(value)
        );
        var fisheyeCircle = me.pvtFisheyeModule.getFishEyeDefaultCircle(value);
        me.pvtControllers[i].setFisheyeCircle(
          fisheyeCircle.x,
          fisheyeCircle.y,
          fisheyeCircle.r,
          fisheyeCircle.width,
          fisheyeCircle.height
        );
      }
    }
  },

  changeFisheyeMountingTypeAll: function (value) {
    var me = this;
    for (var i = 0; i < me.pvtWorkingControlCount; i++) {
      me.pvtControllers[i].setFisheyeMountingType(value);
    }
  },

  changeFisheyeModeAll: function (value) {
    var me = this;
    for (var i = 0; i < me.pvtWorkingControlCount; i++) {
      me.pvtControllers[i].setFisheyeMode(value);
    }
  },

  changePTZModeALL: function (mode) {
    var me = this;
    for (var i = 0; i < me.pvtWorkingControlCount; i++) {
      me.pvtControllers[i].setPTZMode(mode);
    }
  },

  changeStretchAll: function (enable) {
    var me = this;
    for (var i = 0; i < me.pvtWorkingControlCount; i++) {
      me.pvtControllers[i].setStretchToFit(enable);
    }
  },

  setCurrentTime: function (data) {
    var me = this;

    data = data || me.pvtControlPanel.getData();
    var mode = data.mode;

    if (mode != "playback") return;

    var serverIP = data["serverIP"];
    var serverPort = data["serverPort"];
    var account = data["account"];
    var password = data["password"];
    var playbackTime = data["playbackTime"];

    if (!serverIP || !serverPort || !account || !password) return;

    var url = me.URL_SETTIME.replace("{HOSTNAME}", serverIP)
      .replace("{HTTPPORT}", serverPort)
      .replace("{TIME}", playbackTime)
      .replace("{SESSION}", me.pvtSessionKey);
    me._sendURLCommand(url, account, password);
  },

  rewind: function () {
    var me = this;

    var data = me.pvtControlPanel.getData();
    var mode = data.mode;

    if (mode != "playback") return;

    var serverIP = data["serverIP"];
    var serverPort = data["serverPort"];
    var account = data["account"];
    var password = data["password"];
    var rate = data["playRate"] || 0;

    if (!serverIP || !serverPort || !account || !password) return;

    if (me.pvtPlayAction != "B") {
      me.pvtPlayAction = "B";
      me.setPlayRate(rate);
    }

    var url = "";
    if (rate > 0) {
      url = me.URL_PLAY.replace("{HOSTNAME}", serverIP)
        .replace("{HTTPPORT}", serverPort)
        .replace("{SESSION}", me.pvtSessionKey);
    } else {
      // frame by frame, step previous
      url = me.URL_STEPPREVIOUS.replace("{HOSTNAME}", serverIP)
        .replace("{HTTPPORT}", serverPort)
        .replace("{SESSION}", me.pvtSessionKey);
    }
    me._sendURLCommand(url, account, password);
  },

  play: function () {
    var me = this;

    var data = me.pvtControlPanel.getData();
    var mode = data.mode;

    if (mode != "playback") return;

    var serverIP = data["serverIP"];
    var serverPort = data["serverPort"];
    var account = data["account"];
    var password = data["password"];
    var rate = data["playRate"] || 0;

    if (!serverIP || !serverPort || !account || !password) return;

    if (me.pvtPlayAction != "F") {
      me.pvtPlayAction = "F";
      me.setPlayRate(rate);
    }

    var url = "";
    if (rate > 0) {
      for (var i = 0; i < me.pvtWorkingControlCount; i++) {
        me.pvtControllers[i].setPauseFlag(false);
      }

      url = me.URL_PLAY.replace("{HOSTNAME}", serverIP)
        .replace("{HTTPPORT}", serverPort)
        .replace("{SESSION}", me.pvtSessionKey);
    } else {
      // frame by frame, step next
      url = me.URL_STEPNEXT.replace("{HOSTNAME}", serverIP)
        .replace("{HTTPPORT}", serverPort)
        .replace("{SESSION}", me.pvtSessionKey);
    }
    me._sendURLCommand(url, account, password);
  },

  pause: function () {
    var me = this;

    var data = me.pvtControlPanel.getData();
    var mode = data.mode;

    if (mode != "playback") return;

    var serverIP = data["serverIP"];
    var serverPort = data["serverPort"];
    var account = data["account"];
    var password = data["password"];

    if (!serverIP || !serverPort || !account || !password) return;

    for (var i = 0; i < me.pvtWorkingControlCount; i++) {
      me.pvtControllers[i].setPauseFlag(true);
    }

    var url = me.URL_PAUSE.replace("{HOSTNAME}", serverIP)
      .replace("{HTTPPORT}", serverPort)
      .replace("{SESSION}", me.pvtSessionKey);
    me._sendURLCommand(url, account, password);
  },

  setPlayRate: function (rate) {
    var me = this;
    var data = me.pvtControlPanel.getData();
    var mode = data.mode;

    if (mode != "playback") return;

    var serverIP = data["serverIP"];
    var serverPort = data["serverPort"];
    var account = data["account"];
    var password = data["password"];

    if (!serverIP || !serverPort || !account || !password) return;

    var action = me.pvtPlayAction; // F: forward, B: backward
    if (rate == 0) {
      me.pause(); // pause first, and then frame by frame
      rate = "F";
    }

    //Set sync
    let syncplay = true;
    if (action == "F" && rate < 1 && rate != "F") {
      syncplay = false;
    }
    for (var i = 0; i < me.pvtWorkingControlCount; i++) {
      me.pvtControllers[i].setSyncPlay(syncplay);
    }
    //Set direct output
    let directoutput = false;
    if (action == "B" || rate > 2 || rate == "F") {
      directoutput = true;
    }
    for (var i = 0; i < me.pvtWorkingControlCount; i++) {
      me.pvtControllers[i].setDirectOutput(directoutput);
    }

    var url = me.URL_SETMODE.replace("{HOSTNAME}", serverIP)
      .replace("{HTTPPORT}", serverPort)
      .replace("{SESSION}", me.pvtSessionKey)
      .replace("{ACTION}", action)
      .replace("{RATE}", rate);
    me._sendURLCommand(url, account, password);
  },

  testCommand: function () {
    var me = this;

    var data = me.pvtControlPanel.getData();
    var cmd = (data.command || "").trim();
    var serverIP = data["serverIP"];
    var serverPort = data["serverPort"];
    var account = data["account"];
    var password = data["password"];

    if (!cmd || !serverIP || !serverPort || !account || !password) return;

    var url = cmd;
    if (cmd.toLowerCase().indexOf("http") !== 0) {
      var url = "http://" + serverIP + ":" + serverPort;
      if (cmd.indexOf("/") === 0) url += cmd;
      else url += "/" + cmd;
    }

    me._sendURLCommand(url, account, password);
  },

  _sendURLCommand: function (url, account, password, callback) {
    if (!url) return;

    var httpRequest = new XMLHttpRequest();
    if (httpRequest) {
      try {
        httpRequest.onreadystatechange = function () {
          if (httpRequest.readyState === XMLHttpRequest.DONE) {
            if (callback) callback(httpRequest.status === 200);

            httpRequest.onreadystatechange = null;
          }
        };
        httpRequest.open("GET", url, true);

        if (account) {
          httpRequest.setRequestHeader(
            "Access-Control-Allow-Credentials",
            "true"
          );
          httpRequest.setRequestHeader(
            "Authorization",
            "Basic " + Base64.encode(account + ":" + password)
          );
        }
        httpRequest.setRequestHeader(
          "Content-Type",
          "application/x-www-form-urlencoded"
        );
        httpRequest.setRequestHeader("Cache-Control", "no-cache");
        httpRequest.setRequestHeader("Pragma", "no-cache");
        httpRequest.setRequestHeader("Accept", "*/*");

        httpRequest.send();
      } catch (e) {
        httpRequest = null;
        trace("" + url + " " + e);
      }
    }
  },
});

/* Load Page */
window.onload = function () {
  var app = new application();
  app.render(document.body);

  function onMouseWheel(ev) {
    for (var i = 0; i < app.pvtWorkingControlCount; i++) {
      if (app.pvtControllers[i]) {
        var controlRegion = app.pvtControllers[i].getClientRegion();
        if (
          ev.clientX >= controlRegion.left &&
          ev.clientX < controlRegion.right &&
          ev.clientY >= controlRegion.top &&
          ev.clientY < controlRegion.bottom
        ) {
          app.pvtControllers[i].doMouseWheel(ev);
          if (ev.preventDefault) {
            ev.preventDefault();
          }
        }
      }
    }
  }

  if (window.onmousewheel === undefined) {
    window.onwheel = onMouseWheel;
  } else {
    window.onmousewheel = onMouseWheel;
  }

  window.onkeydown = function (ev) {
    if (app) {
      for (var i = 0; i < app.pvtWorkingControlCount; i++) {
        if (app.pvtControllers[i]) {
          app.pvtControllers[i].doKeyDown(ev);
        }
      }
    }
  };

  window.onkeyup = function (ev) {
    if (app) {
      for (var i = 0; i < app.pvtWorkingControlCount; i++) {
        if (app.pvtControllers[i]) {
          app.pvtControllers[i].doKeyUp(ev);
        }
      }
    }
  };
};
