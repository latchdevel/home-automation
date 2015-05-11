/*** InbandNotifications Z-Way HA module *******************************************

Version: 1.0.2
(c) Z-Wave.Me, 2015
-----------------------------------------------------------------------------
Author: Niels Roche <nir@zwave.eu>
Description:
    Creates a module that listens to the status of every device in the background. 
    It sends notifications automatically if it has changed.
******************************************************************************/

// ----------------------------------------------------------------------------
// --- Class definition, inheritance and setup
// ----------------------------------------------------------------------------

function InbandNotifications (id, controller) {
    // Call superconstructor first (AutomationModule)
    InbandNotifications.super_.call(this, id, controller);
}

inherits(InbandNotifications, AutomationModule);

_module = InbandNotifications;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

InbandNotifications.prototype.init = function (config) {
    InbandNotifications.super_.prototype.init.call(this, config);

    // add cron schedule every day
    this.controller.emit("cron.addTask", "inbandNotifierDeleteNotifications.poll", {
        minute: 0,
        hour: 0,
        weekDay: [0,6,1],
        day: null,
        month: null
    });

    // add cron schedule every day
    this.controller.emit("cron.addTask", "inbandNotifierSaveNotifications.poll", {
        minute: 0,
        hour: [0,23,1],
        weekDay: null,
        day: null,
        month: null
    });

    var self = this,
        lastChanges = [];

    this.writeNotification = function (vDev) {
        if(!Boolean(vDev.get('permanently_hidden'))){
            var devId = vDev.get('id'),
                devType = vDev.get('deviceType'),
                devName = vDev.get('metrics:title'),
                scaleUnit = vDev.get('metrics:scaleTitle'),
                lvl = vDev.get('metrics:level'),
                eventType = function(){
                    if(vDev.get('metrics:probeTitle')){
                        return vDev.get('metrics:probeTitle').toLowerCase();
                    }else {
                        return 'status';
                    }
                },
                createItem = 0,
                item, msg, msgType;

            if(lastChanges.filter(function(o){
                            return o.id === devId;
                                        }).length < 1){
                item = {
                        id: devId,
                        l: lvl
                    };

                lastChanges.push(item);
                createItem = 1;
            }

            for(var i = 0; i < lastChanges.length; i++){
                var cl = lastChanges[i]['l'],
                    cid = lastChanges[i]['id'];

                if(lvl === +lvl && lvl !== (lvl|0)) {
                    lvl = lvl.toFixed(1);
                }

                if((cid === devId && cl !== lvl) || (cid === devId && cl === lvl && createItem === 1)){

                    // depending on device type choose the correct notification
                    switch(devType) {
                        case 'switchBinary':
                        case 'switchControl':
                        case 'sensorBinary':
                        case 'fan':
                        case 'doorlock':
                            msg = {
                                dev: devName,
                                l:lvl
                                };
                            msgType = 'device-OnOff';
                            break;
                        case 'switchMultilevel':
                        case 'battery':
                            msg = {
                                dev: devName,
                                l: lvl + '%'
                                };
                            msgType = 'device-status';
                            break;
                        case 'sensorMultilevel':
                        case 'sensorMultiline':
                        case 'thermostat':
                            msg = {
                                dev: devName,
                                l: lvl + ' ' + scaleUnit
                                };
                            msgType = 'device-' + eventType();
                            break;
                        default:
                            break;
                    }

                    self.controller.addNotification('device-info', msg , msgType, devId);
                    lastChanges[i]['l'] = lvl;
                    createItem = 0;
                }
            }
        }     
    };

    this.onPollDeleteNotifications = function () {
        
        var now = new Date(),
            startOfDay = now.setHours(0,0,0,0),
            tsSevenDaysBefore = startOfDay - 86400*6;
        
        self.controller.deleteNotifications(tsSevenDaysBefore, true, this.onPollDeleteNotifications, true);
    };

    this.onPollSaveNotifications = function () {
        self.controller.saveNotifications();
    };

    // Setup metric update event listener
    self.controller.devices.on('change:metrics:level', self.writeNotification);
    this.controller.on("inbandNotifierDeleteNotifications.poll", this.onPollDeleteNotifications);
    this.controller.on("inbandNotifierSaveNotifications.poll", this.onPollSaveNotifications);
};

InbandNotifications.prototype.stop = function () {
    var self = this;

    if (this.timer){
        clearInterval(this.timer);
    }        

    self.controller.devices.off('change:metrics:level', self.writeNotification);
    this.controller.emit("cron.removeTask", "inbandNotifierDeleteNotifications.poll");
    this.controller.off("inbandNotifierDeleteNotifications.poll", this.onPollDeleteNotifications);
    this.controller.emit("cron.removeTask", "inbandNotifierSaveNotifications.poll");
    this.controller.off("inbandNotifierSaveNotifications.poll", this.onPollSaveNotifications);

    InbandNotifications.super_.prototype.stop.call(this);
};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

InbandNotifications.prototype.deviceCollector = function(deviceType){
    var allDevices = this.controller.devices,
        filteredDevices = [];
    
    if(deviceType === 'all'){
        return allDevices;
    } else {   
        
        filteredDevices = allDevices.filter(function (vDev){
            return vDev.get('deviceType') === deviceType;
        });        

        return filteredDevices;  
    }      
};