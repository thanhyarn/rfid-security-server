const mqtt = require("mqtt");

const mqttClient = mqtt.connect("mqtt://20.63.21.232:1883");

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
});

const publishEvent = (topic, message) => {
  mqttClient.publish(topic, JSON.stringify(message), (err) => {
    if (err) {
      console.error("Failed to publish MQTT message:", err);
    } else {
      console.log("MQTT message published:", message);
    }
  });
};

module.exports = { mqttClient, publishEvent };
