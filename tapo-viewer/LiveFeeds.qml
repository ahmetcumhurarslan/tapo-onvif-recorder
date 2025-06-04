import QtQuick
import QtMultimedia
import QtQuick.Layouts
import QtQuick.Controls
import QtQuick.Effects
import QtQuick.Controls.Material

Item {
    anchors.fill: parent

    Component.onCompleted: {
        streamsTimer.restart()
    }

    Timer{
        id: streamsTimer
        interval: 100
        onTriggered: {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", settings.backendIp + '/api/streams');
            xhr.onreadystatechange = function() {
                if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                    console.log("GET response:", xhr.responseText);
                    try{
                        streamsModel.clear()
                        var json = JSON.parse(xhr.responseText)
                        for(var i=0;i<json.length;i++){
                            streamsModel.append(json[i])
                        }
                    }
                    catch(e){
                        console.log("error parsing response")
                    }
                }
            };
            xhr.send();
        }
    }

    ListModel{
        id: streamsModel
    }

    ListView {

        anchors.fill: parent
        model: streamsModel
        spacing: dp(20)
        bottomMargin: dp(10)
        clip: true

        contentItem.anchors.margins: dp(10)


        delegate: Rectangle {
            width: ListView.view.width - dp(20)
            height: (width / 3) * 2 + dp(60)
            radius: dp(12)
            color: "#ffffff"
            border.color: "#dddddd"
            border.width: 1
            anchors.horizontalCenter: parent ? parent.horizontalCenter : undefined
            layer.enabled: true
            layer.effect: MultiEffect {
                shadowEnabled: true
                shadowColor: "#888888"
                shadowBlur: 0.8
                shadowVerticalOffset: 4
                shadowHorizontalOffset: 0
                shadowOpacity: 0.4
            }

            ColumnLayout {

                anchors.fill: parent
                anchors.margins: dp(10)
                spacing: dp(10)

                Rectangle {
                    id: videoContainer
                    Layout.fillWidth: true
                    Layout.preferredHeight: (parent.width / 3) * 2
                    radius: dp(10)
                    color: "#000000"

                    VideoOutput {
                        id: videoOutput
                        anchors.fill: parent
                        fillMode: VideoOutput.PreserveAspectCrop
                    }

                    MediaPlayer {
                        id: player
                        source: model.source ? model.source: ""
                        videoOutput: videoOutput
                        autoPlay: true
                    }
                }

                Text {
                    Layout.fillWidth: true
                    text: model.name ? model.name : ""
                    font.pixelSize: dp(16)
                    font.bold: true
                    color: "#333"
                    horizontalAlignment: Text.AlignHCenter
                }
            }
        }
    }

    property var mediaJSON: [
        { "description": "...", "sources": [ "rtsp://bahce-1:bahce123@192.168.2.5:554/stream1" ], "name": "By Blender Foundation", "thumb": "images/BigBuckBunny.jpg", "title": "Big Buck Bunny" },
        { "description": "...", "sources": [ "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" ], "name": "By Blender Foundation", "thumb": "images/BigBuckBunny.jpg", "title": "Big Buck Bunny" },
        { "description": "...", "sources": [ "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" ], "name": "By Blender Foundation", "thumb": "images/ElephantsDream.jpg", "title": "Elephant Dream" },
        { "description": "...", "sources": [ "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" ], "name": "By Google", "thumb": "images/ForBiggerBlazes.jpg", "title": "For Bigger Blazes" },
        { "description": "...", "sources": [ "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" ], "name": "By Google", "thumb": "images/ForBiggerEscapes.jpg", "title": "For Bigger Escape" },
        { "description": "...", "sources": [ "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4" ], "name": "By Google", "thumb": "images/ForBiggerFun.jpg", "title": "For Bigger Fun" },
        { "description": "...", "sources": [ "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" ], "name": "By Google", "thumb": "images/ForBiggerJoyrides.jpg", "title": "For Bigger Joyrides" }
    ]
}
