#include <ESP8266WiFi.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <FS.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>      // <<< OTA LIBRARY

#define DEFAULT_RELAY_PIN 5

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ---------------- CONFIG ----------------
char mqttServer[40] = "192.168.1.10";
char mqttPort[6]     = "1883";
char relayPinStr[4]  = "5";

WiFiManagerParameter custom_mqtt_server("server", "MQTT Server", mqttServer, 40);
WiFiManagerParameter custom_mqtt_port("port", "MQTT Port", mqttPort, 6);
WiFiManagerParameter custom_relay_pin("relay", "Relay GPIO Pin", relayPinStr, 4);

// ---------------- RUNTIME ----------------
String macStr;
uint8_t relayPin = DEFAULT_RELAY_PIN;
unsigned long lastStatusSent = 0;

// ---------------- MQTT CALLBACK ----------------
void callback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.toLowerCase();

  Serial.printf("MQTT recv > %s = %s\n", topic, msg.c_str());

  if (msg == "turnon") {
    digitalWrite(relayPin, HIGH);
  }
  else if (msg == "turnoff") {
    digitalWrite(relayPin, LOW);
  }
}

// ---------------- SEND STATUS ----------------
void sendStatus() {
  String topic = "/smartPlugs/" + macStr + "/status";
  const char* state = digitalRead(relayPin) ? "on" : "off";
  mqttClient.publish(topic.c_str(), state, true);
  Serial.printf("Status sent: %s\n", state);
}

// ---------------- MQTT CONNECT ----------------
void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT... ");

    if (mqttClient.connect(macStr.c_str())) {
      Serial.println("connected");

      String subTopic = "/smartPlugs/" + macStr;
      mqttClient.subscribe(subTopic.c_str());
    }
    else {
      Serial.printf("failed rc=%d. retrying...\n", mqttClient.state());
      delay(2000);
    }
  }
}

// ---------------- CONFIG LOAD/SAVE ----------------
void loadConfig() {
  if (!SPIFFS.begin()) return;

  if (SPIFFS.exists("/config.json")) {
    File f = SPIFFS.open("/config.json", "r");
    String data = f.readString();
    f.close();

    DynamicJsonDocument doc(512);
    deserializeJson(doc, data);

    strcpy(mqttServer, doc["mqttServer"] | mqttServer);
    strcpy(mqttPort,   doc["mqttPort"]   | mqttPort);
    strcpy(relayPinStr,doc["relayPin"]   | relayPinStr);
  }
}

void saveConfig() {
  DynamicJsonDocument doc(512);
  doc["mqttServer"] = mqttServer;
  doc["mqttPort"]   = mqttPort;
  doc["relayPin"]   = relayPinStr;

  File f = SPIFFS.open("/config.json", "w");
  serializeJson(doc, f);
  f.close();
}

// ---------------- OTA SETUP ----------------
void setupOTA() {
  ArduinoOTA.setHostname(("smartplug-" + macStr).c_str());

  ArduinoOTA.onStart([]() {
    Serial.println("OTA Update Start");
  });

  ArduinoOTA.onEnd([]() {
    Serial.println("\nOTA Update End");
  });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("OTA Progress: %u%%\r", (progress * 100) / total);
  });

  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("OTA Error[%u]\n", error);
  });

  ArduinoOTA.begin();
  Serial.println("OTA Ready");
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n");

  loadConfig();

  relayPin = atoi(relayPinStr);

  macStr = WiFi.macAddress();
  macStr.toLowerCase();
  macStr.replace(":", "-");

  pinMode(relayPin, OUTPUT);
  digitalWrite(relayPin, LOW);

  // WiFiManager
  WiFiManager wm;
  wm.addParameter(&custom_mqtt_server);
  wm.addParameter(&custom_mqtt_port);
  wm.addParameter(&custom_relay_pin);

  if (!wm.autoConnect("SmartPlugSetup")) {
    delay(3000);
    ESP.restart();
  }

  strcpy(mqttServer, custom_mqtt_server.getValue());
  strcpy(mqttPort,   custom_mqtt_port.getValue());
  strcpy(relayPinStr,custom_relay_pin.getValue());

  relayPin = atoi(relayPinStr);
  saveConfig();

  Serial.print("macStr:");
  Serial.println(macStr);

  Serial.print("mqttServer:");
  Serial.println(mqttServer);
  Serial.print("mqttPort:");
  Serial.println(mqttPort);

  mqttClient.setServer(mqttServer, atoi(mqttPort));
  mqttClient.setCallback(callback);

  // ENABLE OTA AFTER WIFI IS CONNECTED
  setupOTA();

  Serial.printf("WiFi OK %s\n", WiFi.localIP().toString().c_str());
}

// ---------------- LOOP ----------------
void loop() {
  ArduinoOTA.handle();      // <<< OTA MUST BE HANDLED HERE

  if (!mqttClient.connected()) connectMQTT();
  mqttClient.loop();

  unsigned long now = millis();
  if (now - lastStatusSent > 30000) {
    lastStatusSent = now;
    sendStatus();
  }
}