import mqtt from "mqtt";

console.log("------------------------ MQTT TEST -----------------------");

const client = mqtt.connect("mqtt://192.168.1.19:1883");

client.on("connect", () => {
    console.log("Connected!");
    client.publish("test/topic", "Hello MQTT", {}, (err) => {
        if (err) console.error("Publish error:", err);
        else console.log("Message published successfully");
    });

    client.publish("cameraevents/motionevents/deneme/IsMotion", "true");
});

client.on("error", (err) => {
    console.error("Connection error:", err);
});