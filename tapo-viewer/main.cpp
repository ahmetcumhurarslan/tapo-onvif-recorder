#include <QApplication>
#include <QQmlApplicationEngine>
#include <QScreen>
#include <QQmlContext>
#include <QtWebView>
#include <QDebug>


int main(int argc, char *argv[])
{
    // Set environment variables first
    qputenv("QT_MEDIA_BACKEND", "ffmpeg");
    //qputenv("QT_DEBUG_PLUGINS", "1");
    qputenv("QT_WEBVIEW_PLUGIN", "native");

    // Try initializing with explicit backend
    QtWebView::initialize();

    QApplication app(argc, argv);

    // Debug: Print available WebView backends
    qDebug() << "WebView backend initialized";

    // Your existing code...
    qreal refDpi = 72.;
    qreal refHeight = 667.;
    qreal refWidth = 375.;
    QRect rect = QGuiApplication::primaryScreen()->geometry();
    qreal m_height = qMax(rect.width(), rect.height());
    qreal m_width = qMin(rect.width(), rect.height());
    qreal dpi = QGuiApplication::primaryScreen()->logicalDotsPerInch();
    qreal m_ratio = qMin(m_height / refHeight, m_width / refWidth);

    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty("m_ratio", m_ratio);

    const QUrl url(QStringLiteral("qrc:/tapo-viewer/main.qml"));
    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreated,
        &app,
        [url](QObject *obj, const QUrl &objUrl) {
            if (!obj && url == objUrl)
                QCoreApplication::exit(-1);
        },
        Qt::QueuedConnection);
    engine.load(url);

    return app.exec();
}
