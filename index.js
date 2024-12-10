const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { echo, broadcastData } = require("./src/config/wsConfig"); // Import thêm broadcastData
const http = require("http");
const route = require("./src/routers");
const Epc = require("./src/App/models/Epc");
const db = require("./src/config/dbConfig");
const axios = require("axios");
const path = require("path");
const fs = require("fs"); // Import module fs
const player = require("play-sound")((opts = {}));
db.connect();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
echo.installHandlers(server, { prefix: "/echo" });

route(app);

const PORT = 3002;
const WS_PORT = 8091;

// Tạo API POST để nhận dữ liệu EPC từ client
app.post("/send-epc", async (req, res) => {
  let { epc } = req.body; // Lấy dữ liệu EPC từ body của request

  // Loại bỏ tất cả các dấu cách trong chuỗi EPC
  epc = epc.replace(/\s+/g, "");

  console.log(epc);

  // Kiểm tra nếu EPC không được cung cấp
  if (!epc) {
    return res.status(400).send({ message: "EPC is required" });
  }

  try {
    // Tìm EPC trong cơ sở dữ liệu
    const epcData = await Epc.findOne({ epc });

    // Nếu không tìm thấy EPC
    if (!epcData) {
      return res.status(404).send({ message: "EPC not found in the database" });
    }

    // Gửi dữ liệu EPC đến các client qua SockJS
    broadcastData(epcData);

    // Trả về thông tin EPC
    return res.status(200).send({
      message: "EPC data retrieved successfully",
      data: epcData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "Error retrieving EPC data" });
  }
});

// API để phát âm thanh cảnh báo
app.get("/play-alarm", (req, res) => {
  const filePath = path.join(__dirname, "src/sounds/alarm.mp3");

  player.play(filePath, (err) => {
    if (err) {
      console.error("Error playing sound:", err);
      return res.status(500).send({ message: "Failed to play sound" });
    }
    console.log("Sound played successfully");
    res.status(200).send({ message: "Sound played successfully" });
  });
});


// Tạo API proxy để gọi đến `http://192.168.1.44/toggle?led=2`
app.get("/proxy/toggle", async (req, res) => {
  try {
    // Gửi yêu cầu GET đến API đích
    const response = await axios.get("http://192.168.1.44/toggle?led=2");

    // Gửi lại phản hồi từ API đích về client
    res.status(response.status).send({
      message: "LED toggled successfully via proxy",
      data: response.data,
    });
  } catch (error) {
    // Xử lý lỗi nếu API đích không hoạt động hoặc có lỗi khác
    console.error("Error calling target API:", error.message);
    if (error.response) {
      res.status(error.response.status).send({
        message: "Failed to toggle LED via proxy",
        error: error.response.data,
      });
    } else {
      res.status(500).send({
        message: "Unexpected error occurred while calling target API",
        error: error.message,
      });
    }
  }
});

app.listen(PORT, () => console.log(`HTTP server listening on port ${PORT}`));
server.listen(WS_PORT, () =>
  console.log(`SockJS server running on port ${WS_PORT}`)
);
