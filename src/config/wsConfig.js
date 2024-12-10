const sockjs = require("sockjs");

const connections = []; // Đây là một mảng có thể thay đổi nội dung nhưng không thay đổi tham chiếu

const echo = sockjs.createServer();

echo.on("connection", function (conn) {
  console.log("Conn data: ", conn);
  connections.push(conn);
  conn.on("data", function (message) {
    // Xử lý tin nhắn nhận được từ client nếu cần
  });
  conn.on("close", function () {
    // Chỉ cập nhật mảng mà không gán lại
    const index = connections.indexOf(conn);
    if (index > -1) {
      connections.splice(index, 1);
    }
  });
});

function broadcastData(data) {
  connections.forEach((conn) => conn.write(JSON.stringify(data)));
}

module.exports = { echo, broadcastData };
