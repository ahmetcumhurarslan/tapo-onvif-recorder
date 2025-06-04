import QtQuick
import QtWebView

Item {
    id: recordsRoot
    anchors.fill: parent
    property string backendUrl: ""


    Loader{
        anchors.fill: parent
        active: topMenu.opacity === 0
        sourceComponent:     WebView{
            anchors.fill: parent
            url: recordsRoot.backendUrl
        }
    }



}
