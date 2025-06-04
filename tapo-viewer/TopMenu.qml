import QtQuick
import QtQuick.Controls
//import safe.area 1.0

import QtQuick.Controls.Material

Item{
    property alias menu: menu
    property int menuWidth: dp(300)
    property bool isOpen: menu.width === menuWidth

    anchors.fill: parent
    // anchors.topMargin: -safeArea.topMargin
    // anchors.bottomMargin: -safeArea.bottomMargin
    // anchors.leftMargin: -safeArea.leftMargin
    // anchors.rightMargin: -safeArea.rightMargin
    visible: opacity>0
    opacity: 0

    function open(){
        opacity = 1
        menu.width = menuWidth
        menu.height = menu.contentHeight
    }

    function close(){
        opacity = 0
        menu.width = 0
        menu.height = 0
    }

    Behavior on opacity{
        NumberAnimation { duration: 200}
    }

    Rectangle{
        anchors.fill: parent
        color: Material.primary //"white"
        opacity: 1
        MouseArea{
            anchors.fill: parent
            onClicked: {
                close()
            }
        }
    }

    Item{
        anchors.fill: parent
        // anchors.topMargin: safeArea.topMargin
        // anchors.bottomMargin: safeArea.bottomMargin
        // anchors.leftMargin: safeArea.leftMargin
        // anchors.rightMargin: safeArea.rightMargin

        ListView{
            id: menu
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.topMargin: dp(5)
            anchors.rightMargin: dp(10)
            spacing: 0
            interactive: false

            height: contentHeight
            delegate: Item{
                id: menuDelegate
                width: parent ? parent.width : 0
                height: visible ? dp(50) : 1
                visible: topMenu.menu.model[index].v ? topMenu.menu.model[index].v() : true


                Button{
                    text: topMenu.menu.model[index].t
                    anchors.fill: parent
                    Material.accent: topMenu.menu.model[index].c ? topMenu.menu.model[index].c : "white"
                    highlighted: topMenu.menu.model[index].c ? true : false
                    font.pointSize: dp(14)
                    onClicked: {
                        if(topMenu.menu.model[index].f){
                            topMenu.menu.model[index].f()
                        }
                    }
                }
            }

            Behavior on width{
                NumberAnimation { duration: 200}
            }
            Behavior on height{
                NumberAnimation { duration: 200}
            }
        }



        Text {
            text: Qt.application.version
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.bottom: parent.bottom
            anchors.bottomMargin: dp(30)
            font.pointSize: dp(14)
            color: "white"
        }

    }



}
