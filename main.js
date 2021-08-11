// integrates all the functionality, connects the call, handles it and ends it

// configuration set up for conference room. (refer confernce.js)
var config = {

    // things to do when a socket is opened
    openSocket: function(config) {
        var SIGNALING_SERVER = 'https://socketio-over-nodejs2.herokuapp.com:443/';
        config.channel = config.channel || location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
        var sender = Math.round(Math.random() * 999999999) + 999999999;
        // connecting the channed to signalling server
        io.connect(SIGNALING_SERVER).emit('new-channel', {
            channel: config.channel,
            sender: sender
        });

        // after connection, socket is embedded into signalling server
        var socket = io.connect(SIGNALING_SERVER + config.channel);
        socket.channel = config.channel;

        // functionality of connections to socket
        socket.on('connect', function () {
            if (config.callback) config.callback(socket);
        });

        // adding fucntionality of sending a message to socket
        socket.send = function (message) {
            socket.emit('message', {
                sender: sender,
                data: message
            });
        };

        socket.on('message', config.onmessage);
    },

    // things to do when remote stream is connected
    onRemoteStream: function(media) {
        // configuring the received video
        var mediaElement = getMediaElement(media.video, {
            width: (videosContainer.clientWidth / 2) - 50,
            buttons: ['mute-audio', 'mute-video', 'full-screen', 'volume-slider']
        });
        // adding that media into the media element in the page
        mediaElement.id = media.stream.streamid;
        videosContainer.appendChild(mediaElement);
    },

    // things to do when a remote stream stops coming into
    onRemoteStreamEnded: function(stream, video) {
        if (video.parentNode && video.parentNode.parentNode && video.parentNode.parentNode.parentNode) {
            // disconnect the corresponding user
            video.parentNode.parentNode.parentNode.removeChild(video.parentNode.parentNode);
        }
    },
    
    // if a room is found in the sockets
    onRoomFound: function(room) {
        var alreadyExist = document.querySelector('button[data-broadcaster="' + room.broadcaster + '"]');
        if (alreadyExist) return;

        if (typeof roomsList === 'undefined') roomsList = document.body;

        // display that room is found
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>Conference room - <strong>' + room.roomName + '</strong> is shared with you.</td>' +
            '<td><button class="join">Join</button></td>';
        roomsList.appendChild(tr);

        // settig attributes for join the room button
        var joinRoomButton = tr.querySelector('.join');
        joinRoomButton.setAttribute('data-broadcaster', room.broadcaster);
        joinRoomButton.setAttribute('data-roomToken', room.roomToken);
        // the click-on function
        joinRoomButton.onclick = function() {
            this.disabled = true;

            var broadcaster = this.getAttribute('data-broadcaster');
            var roomToken = this.getAttribute('data-roomToken');

            // joining the room
            captureUserMedia(function() {
                conferenceUI.joinRoom({
                    roomToken: roomToken,
                    joinUser: broadcaster,
                    userName: prompt('Enter your name', 'Anonymous')
                });
                hideUnnecessaryStuff();
            }, function() {
                joinRoomButton.disabled = false;
            });
        };
    },
    onChannelOpened: function(/* channel */) {
        unnecessaryStuffVisible && hideUnnecessaryStuff();
        if (fileElement) fileElement.removeAttribute('disabled');
    },

    // what should happen if there is a message in channel
    onChannelMessage: function(data) {
        if (!chatOutput) return;
        var t = true;
        try {
            JSON.parse(data.message);
        } catch (error) {
            if (error) {t = false;};
        }
        // if the message is a file transfer data packet
        if(t){
            console.log(data);
            onMessageCallback(JSON.parse(data.message));
        }
        // else if the message is a chat room message
        else{
            var tr = document.createElement('tr');
            // add the messge to the chat window
            tr.innerHTML =
                '<td style="width:40%;">' + data.sender + '</td>' +
                    '<td>' + data.message + '</td>';

            chatOutput.insertBefore(tr, chatOutput.firstChild);
            var tr = document.createElement('tr');
           
        }
        
    },

    // if room is closed
    onRoomClosed: function(room) {
        var joinButton = document.querySelector('button[data-roomToken="' + room.roomToken + '"]');
        // cut of all children
        if (joinButton) {
            joinButton.parentNode.parentNode.parentNode.parentNode.removeChild(joinButton.parentNode.parentNode.parentNode);
        }
    },
    onReady: function() {
        console.log('now you can open or join rooms');
    }
};


// capturing user media (getting user media and adding it to the page)
function captureUserMedia(callback, failure_callback) {
    // define parameters
    var video = document.createElement('video');
    video.muted = true;
    video.volume = 0;
    try {
        video.setAttributeNode(document.createAttribute('autoplay'));
        video.setAttributeNode(document.createAttribute('playsinline'));
        video.setAttributeNode(document.createAttribute('controls'));
    } catch (e) {
        video.setAttribute('autoplay', true);
        video.setAttribute('playsinline', true);
        video.setAttribute('controls', true);
    }

    // getting the user media
    getUserMedia({
        video: video,
        onsuccess: function(stream) {
            config.attachStream = stream;

            var mediaElement = getMediaElement(video, {
                width: (videosContainer.clientWidth / 2) - 50,
                buttons: ['mute-audio', 'mute-video', 'full-screen', 'volume-slider']
            });
            mediaElement.toggle('mute-audio');
            videosContainer.appendChild(mediaElement);

            callback && callback();
        },
        onerror: function() {
            alert('unable to get access to your webcam');
            callback && callback();
        }
    });
}


// calling the UI refresher every 1 second
(function selfInvoker() {
    setTimeout(function() {
        if (typeof window.RTCPeerConnection != 'undefined') setUserInterface();
        else selfInvoker();
    }, 1000);
})();

var conferenceUI = conference(config);

// UI specific 

var videosContainer = document.getElementById('videos-container') || document.body;
var btnSetupNewRoom = document.getElementById('setup-new-room');
var roomsList = document.getElementById('rooms-list');

if (btnSetupNewRoom) btnSetupNewRoom.onclick = setupNewRoomButtonClickHandler;
var chatOutput = document.getElementById('chat-output');

// Creating a new room 
function setupNewRoomButtonClickHandler() {
    btnSetupNewRoom.disabled = true;
    document.getElementById('conference-name').disabled = true;
    captureUserMedia(function() {
        conferenceUI.createRoom({
            userName: prompt('Enter your name', 'Anonymous'),
            roomName: (document.getElementById('conference-name') || { }).value || 'Anonymous'
        });
        hideUnnecessaryStuff();
    }, function() {
        btnSetupNewRoom.disabled = document.getElementById('conference-name').disabled = false;
    });
    
}

// sets the UI based on the instantaneous conditions
function setUserInterface() {
    fileElement = document.getElementById('file');
    fileElement.onchange = function() {
        var file = fileElement.files[0];

        var html = getFileHTML(file);
        var div = quickOutput('Now sending:', html);
        
        // the file transfer implementation
        FileSender.send({
            channel: conferenceUI,
            file: file,
            onFileSent: function(file) {
                quickOutput(file.name, 'sent successfully!');
                disable(false);
                statusDiv.innerHTML = '';
                div.parentNode.removeChild(div);
            },
            onFileProgress: function(e) {
                // displaying the status of file transfers
                statusDiv.innerHTML = e.sent + ' packets sent. ' + e.remaining + ' packets remaining.';
            }
        });

        return disable(true);
    };

    outputPanel = document.getElementById('output-panel');
    statusDiv = document.getElementById('status');
    unnecessaryStuffVisible = true;

   var uniqueToken = document.getElementById('unique-token');
    if (uniqueToken)
        if (location.hash.length > 2) uniqueToken.parentNode.parentNode.parentNode.innerHTML = '<h2 style="text-align:center;display: block;"><a href="' + location.href + '" target="_blank">Right click to copy & share this private link</a></h2>';
        else uniqueToken.innerHTML = uniqueToken.parentNode.parentNode.href = '#' + (Math.random() * new Date().getTime()).toString(36).toUpperCase().replace( /\./g , '-');
}

// Rotation of video
function rotateVideo(video) {
    video.style[navigator.mozGetUserMedia ? 'transform' : '-webkit-transform'] = 'rotate(0deg)';
    setTimeout(function() {
        video.style[navigator.mozGetUserMedia ? 'transform' : '-webkit-transform'] = 'rotate(360deg)';
    }, 1000);
}

// a common function which hides all the unused stuff on the page
function hideUnnecessaryStuff() {
    var visibleElements = document.getElementsByClassName('visible'),
        length = visibleElements.length;

    for (var i = 0; i < length; i++) {
        visibleElements[i].style.display = 'none';
    }

    unnecessaryStuffVisible = false;

    var chatTable = document.getElementById('chat-table');
    if (chatTable) chatTable.style.display = 'block';
    if (chatOutput) chatOutput.style.display = 'block';
    if (chatMessage) chatMessage.disabled = false;
}
// insert the chat message 
var chatMessage = document.getElementById('chat-message');
if (chatMessage)
    chatMessage.onchange = function() {
        conferenceUI.send(this.value);
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td style="width:40%;">You:</td>' +
                '<td>' + chatMessage.value + '</td>';

        chatOutput.insertBefore(tr, chatOutput.firstChild);
        chatMessage.value = '';
    };

// UI,scales the videos on resizing
function scaleVideos() {
    var videos = document.querySelectorAll('video'),
        length = videos.length, video;

    var minus = 130;
    var windowHeight = 700;
    var windowWidth = 600;  
    var windowAspectRatio = windowWidth / windowHeight;
    var videoAspectRatio = 4 / 3;
    var blockAspectRatio;
    var tempVideoWidth = 0;
    var maxVideoWidth = 0;

    for (var i = length; i > 0; i--) {
        blockAspectRatio = i * videoAspectRatio / Math.ceil(length / i);
        if (blockAspectRatio <= windowAspectRatio) {
            tempVideoWidth = videoAspectRatio * windowHeight / Math.ceil(length / i);
        } else {
            tempVideoWidth = windowWidth / i;
        }
        if (tempVideoWidth > maxVideoWidth)
            maxVideoWidth = tempVideoWidth;
    }
    for (var i = 0; i < length; i++) {
        video = videos[i];
        if (video)
            video.width = maxVideoWidth - minus;
    }
}

window.onresize = scaleVideos;

// file transfer part


var fileReceiver = new FileReceiver();

function onMessageCallback(data) {
    if (data.connected) {
        quickOutput('Your friend is connected.');
        return;
    }

    disable(true);

    // receive file packets
    fileReceiver.receive(data, {
        onFileReceived: function(fileName) {
            quickOutput(fileName, 'received successfully!');
            disable(false);
            statusDiv.innerHTML = '';
        },
        onFileProgress: function(e) {
            statusDiv.innerHTML = e.received + ' packets received. ' + e.remaining + ' packets remaining.';
        }
    });
}
// displays the received file on an iframe
function getFileHTML(file) {
    var url = file.url || URL.createObjectURL(file);
    var attachment = '<a href="' + url + '" download="">Click To Download</a><br>';
    attachment += '<iframe src="' + url + '" style="border:0;width:100%;min-height:300px;"></iframe></a>';
    return attachment;
}

function getRandomString() {
    return (Math.random() * new Date().getTime()).toString(36).toUpperCase().replace( /\./g , '-');
}

// file sending handler
var FileSender = {
    send: function(config) {
        var channel = config.channel,
            file = config.file;

        // 10kb packs
        var packetSize = 10 * 1000,
            textToTransfer = '',
            numberOfPackets = 0,
            packets = 0;

        // uuid is used to uniquely identify sending instance
        var uuid = getRandomString();

        // reading the data as URL
        var reader = new window.FileReader();
        reader.readAsDataURL(file);
        reader.onload = onReadAsDataURL;

        function onReadAsDataURL(event, text) {
            var data = {
                type: 'file',
                uuid: uuid
            };

            if (event) {
                text = event.target.result;
                numberOfPackets = packets = data.packets = parseInt(text.length / packetSize);
            }

            // keeps track of sent packets and to be sent packets
            if (config.onFileProgress)
                config.onFileProgress({
                    remaining: packets--,
                    length: numberOfPackets,
                    sent: numberOfPackets - packets
                }, uuid);

            if (text.length > packetSize) data.message = text.slice(0, packetSize);
            else {
                data.message = text;
                data.last = true;
                data.name = file.name;

                if (config.onFileSent) config.onFileSent(file);
            }

            // WebRTC-DataChannels.send(data, privateDataChannel)
            channel.send(JSON.stringify(data));

            textToTransfer = text.slice(data.message.length);

            if (textToTransfer.length) {
                setTimeout(function() {
                    onReadAsDataURL(null, textToTransfer);
                }, 100);
            }
        }
    }
};

// file receiving handler
function FileReceiver() {
    var content = { },
        packets = { },
        numberOfPackets = { };

    function receive(data, config) {
        // uuid is used to uniquely identify sending instance
        var uuid = data.uuid;

        if (data.packets) numberOfPackets[uuid] = packets[uuid] = parseInt(data.packets);
        // keeps track of receiving process
        if (config.onFileProgress)
            config.onFileProgress({
                remaining: packets[uuid]--,
                length: numberOfPackets[uuid],
                received: numberOfPackets[uuid] - packets[uuid]
            }, uuid);

        if (!content[uuid]) content[uuid] = [];

        content[uuid].push(data.message);
        
        // make the data into JSON blob and sends to channel
        if (data.last) {
            var dataURL = content[uuid].join('');
            var blob = FileConverter.DataUrlToBlob(dataURL);
            var virtualURL = (window.URL || window.webkitURL).createObjectURL(blob);
            
            // todo: should we use virtual-URL or data-URL?
            // FileSaver.SaveToDisk(dataURL, data.name);
            blob.url = virtualURL;
            var html = getFileHTML(blob);
            quickOutput('Download:', html);

            if (config.onFileReceived) config.onFileReceived(data.name);
            delete content[uuid];
        }
    }

    return {
        receive: receive
    };
}

// saving the file helper
var FileSaver = {
    SaveToDisk: function(fileUrl, fileName) {
        var hyperlink = document.createElement('a');
        hyperlink.href = fileUrl;
        hyperlink.target = '_blank';
        hyperlink.download = fileName || fileUrl;

        var mouseEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });

        hyperlink.dispatchEvent(mouseEvent);
        (window.URL || window.webkitURL).revokeObjectURL(hyperlink.href);
    }
};

// Convert the URL data to JSON blob
var FileConverter = {
    DataUrlToBlob: function(dataURL) {
        var binary = atob(dataURL.substr(dataURL.indexOf(',') + 1));
        var array = [];
        for (var i = 0; i < binary.length; i++) {
            array.push(binary.charCodeAt(i));
        }

        var type;

        try {
            type = dataURL.substr(dataURL.indexOf(':') + 1).split(';')[0];
        } catch(e) {
            type = 'text/plain';
        }

        return new Blob([new Uint8Array(array)], { type: type });
    }
};


// inserts the text to the progress checker line
function quickOutput(message, message2) {
    if (!outputPanel) return;
    if (message2) message = '<strong>' + message + '</strong> ' + message2;

    var tr = document.createElement('tr');
    tr.innerHTML = '<td style="width:80%;">' + message + '</td>';
    outputPanel.insertBefore(tr, outputPanel.firstChild);

    return tr;
}

function disable(_disable) {
    if (!fileElement) return;
    if (!_disable) fileElement.removeAttribute('disabled');
    else fileElement.setAttribute('disabled', true);
}
