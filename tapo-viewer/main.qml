import QtQuick
import QtQuick.Window
import QtMultimedia
import QtQuick.Layouts
import QtQuick.Controls
import QtQuick.Effects
import QtQuick.Controls.Material
import QtCore

Window {
    width: dp(430)
    height: dp(800)
    visible: true
    title: qsTr("Tapo Viewer")
    color: "#f0f0f0"

    Material.theme: Material.Light
    Material.primary: Material.color(Material.Blue,Material.Shade800)
    property color secondary: Material.color(Material.Blue,Material.Shade600)
    property color third: Material.color(Material.Blue,Material.Shade400)
    Material.accent: Material.color(Material.Blue)


    function dp(px) {
        if (Qt.platform.os === "linux" || Qt.platform.os === "osx")
            return m_ratio * px * 0.35
        return m_ratio * px
    }

    Settings {
        id: settings
        property alias backendIp: backendIpTextField.text
    }

    Item{
        id: topArea
        width: parent.width
        height: dp(50)

        Text{
            text: "Tapo Viewer"
            verticalAlignment: Text.AlignVCenter
            horizontalAlignment: Text.AlignHCenter
            anchors.fill: parent
            font.pointSize: dp(18)
            font.bold: true
        }

        //menu icon
        Item{
            height: dp(28)
            width: height
            anchors.right: parent.right
            anchors.rightMargin: dp(15)
            anchors.verticalCenter: parent.verticalCenter
            opacity: 1

            Column{
                width: parent.width
                anchors.centerIn: parent
                spacing: parent.width * 0.15
                Rectangle{
                    width: parent.width
                    height: Math.ceil(parent.width * 0.15)
                    color: secondary
                    radius: dp(1)
                }
                Rectangle{
                    width: parent.width
                    height: Math.ceil(parent.width * 0.15)
                    color: secondary
                    radius: dp(1)
                }
                Rectangle{
                    width: parent.width
                    height: Math.ceil(parent.width * 0.15)
                    color: secondary
                    radius: dp(1)
                }
            }



            MouseArea{
                onPressedChanged: {
                    if(pressed) parent.opacity = 0.6
                    else parent.opacity = 1
                }

                anchors.fill: parent
                anchors.margins: -dp(8)
                onClicked: {
                    topMenu.open()
                }
            }
        }
    }

    property Component liveFeeds: LiveFeeds{}
    property Component records: Records{
        backendUrl: settings.backendIp
    }

    Loader{
        id: mainLoader
        anchors.fill: parent
        anchors.topMargin: topArea.height
        sourceComponent: liveFeeds
    }



    TopMenu{
        id: topMenu
        menu.model: [
            {
                t: qsTr("Canlı Yayın"),
                c: "darkblue",
                f: function(){
                    mainLoader.sourceComponent = undefined
                    mainLoader.sourceComponent = liveFeeds
                    topMenu.close()
                }
            },
            {
                t: qsTr("Kayıtlar"),
                c: "darkblue",
                f: function(){
                    mainLoader.sourceComponent = undefined
                    mainLoader.sourceComponent = records
                    topMenu.close()
                }
            }
        ]


        TextField{
            id: backendIpTextField
            anchors.bottom: parent.bottom
            anchors.bottomMargin: dp(20)
            width: parent.width - dp(80)
            anchors.horizontalCenter: parent.horizontalCenter
            height: dp(40)
            background: Rectangle{}
            text: "http://localhost:3000"
        }

    }

}
