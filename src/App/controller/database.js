const fs = require("fs");
const sql = require("mssql");
const dbConfig = require("../../config/dbConfig");
const { publishEvent } = require("../../config/mqttConfig");
const { broadcastData } = require("../../config/wsConfig");
const mqtt = require("mqtt");

class Database {
  async fetchData(req, res) {
    function processData(data) {
      const grouped = data.reduce((acc, item) => {
        if (!acc[item.information]) {
          acc[item.information] = {
            name: item.information,
            classify: item.classification_name,
            data: [],
          };
        }
        acc[item.information].data.push({
          epc: item.epc,
          timestamp: item.timestamp,
        });
        return acc;
      }, {});

      return Object.values(grouped).map((group) => ({
        ...group,
        amount: group.data.length,
      }));
    }

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);
      let result = await sql.query`SELECT
          E.epc,
          B.information,
          E.timestamp,
          C.name AS classification_name,
          E.warehouse
      FROM
          TableEPC E
      JOIN
          TableBarcode B ON E.barcode = B.barcode
      JOIN
          Classification C ON B.classification_id = C.id;
      `;

      // const arrayData = processData(result.recordset);
      const arrayData = result.recordset;

      // Insert the record into TableRecord
      // await sql.query`INSERT INTO TableRecord (epc, timestamp, warehouse) VALUES (${epc}, ${timestamp}, ${newWarehouse})`;

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // broadcastData(arrayData);

      res.status(200).json({
        arrayData,
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to search EPC records" });
    }
  }

  async getBarcodeById(req, res) {
    const barcodeId = req.params.barcode; // Lấy barcode ID từ request params
    console.log(`Fetching barcode with ID ${barcodeId}`);

    try {
      // Kết nối đến cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Thực hiện truy vấn SQL để lấy thông tin barcode dựa trên ID
      const result =
        await sql.query`SELECT * FROM TableBarcode WHERE barcode = ${barcodeId}`;

      sql.close(); // Đóng kết nối sau khi truy vấn thành công

      if (result.recordset.length > 0) {
        // Nếu tìm thấy barcode với ID tương ứng, gửi phản hồi với dữ liệu
        res.status(200).json({
          message: "Barcode fetched successfully",
          data: result.recordset,
        });
      } else {
        // Nếu không tìm thấy barcode, gửi phản hồi lỗi
        res.status(404).json({ message: "Barcode not found" });
      }
    } catch (err) {
      // Xử lý lỗi nếu có lỗi xảy ra khi truy vấn cơ sở dữ liệu
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to fetch barcode" });
    }
  }

  async fetchAllBarcode(req, res) {
    console.log("Join to fetch All barcode");
    try {
      await sql.connect(dbConfig);
      const result = await sql.query("SELECT * FROM TableBarcode");
      sql.close();
      // Gửi dữ liệu tới clients qua WebSocket
      // publishEvent("barcodeData", result.recordset);
      // Gửi phản hồi HTTP
      const finalData = result.recordset;

      res
        .status(200)
        .json({ message: "Data fetched successfully", data: result.recordset });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to fetch data" });
    }
  }

  async getBarcodeByClassify(req, res) {
    const classify = req.params.classify;
    try {
      // Kết nối đến cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Thực hiện truy vấn SQL để lấy danh sách barcodes dựa trên classification_id
      const result =
        await sql.query`SELECT * FROM TableBarcode WHERE classification_id = ${classify}`;

      sql.close(); // Đóng kết nối sau khi truy vấn thành công

      if (result.recordset.length > 0) {
        // Nếu tìm thấy các barcodes với classification_id tương ứng, gửi phản hồi với dữ liệu
        res.status(200).json({
          message: "Barcodes fetched successfully",
          data: result.recordset,
        });
      } else {
        // Nếu không tìm thấy barcodes, gửi phản hồi lỗi
        res
          .status(404)
          .json({ message: "No barcodes found for this classification" });
      }
    } catch (err) {
      // Xử lý lỗi nếu có lỗi xảy ra khi truy vấn cơ sở dữ liệu
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to fetch barcodes" });
    }
  }

  async addBarcode(req, res) {
    console.log("Attempting to add a new barcode");

    // Giả định rằng req.body chứa các trường 'barcode', 'information', và 'classify'
    const { barcode, information, classify } = req.body;

    console.log(barcode);
    console.log(information);
    console.log(classify);

    if (!barcode || !information || !classify) {
      return res.status(400).json({
        message: "Barcode, information, and classification are required",
      });
    }

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Kiểm tra xem classification_id có tồn tại trong bảng Classification hay không
      const classificationResult = await sql.query(
        `SELECT id FROM Classification WHERE id = '${classify}'`
      );

      if (classificationResult.recordset.length === 0) {
        return res.status(400).json({ message: "Invalid classification ID" });
      }

      // Thực hiện câu lệnh SQL để thêm dữ liệu vào cơ sở dữ liệu
      const result = await sql.query(
        `INSERT INTO TableBarcode (barcode, information, classification_id) VALUES ('${barcode}', N'${information}', '${classify}')`
      );

      const selectAllData = await sql.query("SELECT * FROM TableBarcode");

      console.log("selectAllData", selectAllData.recordset);
      const finalData = selectAllData.recordset;

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi phản hồi thành công về cho client
      res.status(201).json({
        message: "Barcode added successfully",
        data: { barcode, information, classify },
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to add barcode" });
    }
  }

  async updateBarcode(req, res) {
    // Giả định rằng req.body chứa các trường 'barcode', 'information', và 'classify'
    const { barcode, information, classification_id } = req.body;

    if (!barcode || !information || !classification_id) {
      return res.status(400).json({
        message: "Barcode, information, and classification are required",
      });
    }

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Kiểm tra xem barcode đã tồn tại trong cơ sở dữ liệu hay chưa
      const barcodeExist = await sql.query(
        `SELECT * FROM TableBarcode WHERE barcode = '${barcode}'`
      );

      if (barcodeExist.recordset.length === 0) {
        return res.status(404).json({ message: "Barcode not found" });
      }

      // Kiểm tra xem classification_id có tồn tại trong bảng Classification không
      const classificationResult = await sql.query(
        `SELECT id FROM Classification WHERE id = '${classification_id}'`
      );

      if (classificationResult.recordset.length === 0) {
        return res.status(400).json({ message: "Invalid classification ID" });
      }

      // Thực hiện câu lệnh SQL để cập nhật dữ liệu vào cơ sở dữ liệu
      const result = await sql.query(
        `UPDATE TableBarcode
         SET information = N'${information}', classification_id = '${classification_id}'
         WHERE barcode = '${barcode}'`
      );

      // Truy vấn lại toàn bộ dữ liệu sau khi cập nhật để broadcast
      const selectAllData = await sql.query("SELECT * FROM TableBarcode");
      console.log("selectAllData", selectAllData.recordset);
      const finalData = selectAllData.recordset;

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi phản hồi thành công về cho client
      res.status(200).json({
        message: "Barcode updated successfully",
        data: { barcode, information, classification_id },
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to update barcode" });
    }
  }

  async deleteBarcode(req, res) {
    console.log("Attempting to delete a barcode");

    // Lấy barcode từ tham số truyền vào trong URL
    const { barcode } = req.params;

    if (!barcode) {
      return res.status(400).json({ message: "Barcode parameter is required" });
    }

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Kiểm tra xem barcode có tồn tại trong cơ sở dữ liệu không
      const checkExist = await sql.query(
        `SELECT * FROM TableBarcode WHERE barcode = '${barcode}'`
      );
      if (checkExist.recordset.length === 0) {
        return res.status(404).json({ message: "Barcode not found" });
      }

      // Thực hiện câu lệnh SQL để xóa barcode từ cơ sở dữ liệu
      const result = await sql.query(
        `DELETE FROM TableBarcode WHERE barcode = '${barcode}'`
      );

      // Truy vấn lại toàn bộ dữ liệu sau khi xóa để broadcast
      const selectAllData = await sql.query("SELECT * FROM TableBarcode");
      console.log("selectAllData after deletion", selectAllData.recordset);
      const finalData = selectAllData.recordset;

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi phản hồi thành công về cho client
      res.status(200).json({
        message: "Barcode deleted successfully",
        barcode: barcode,
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to delete barcode" });
    }
  }

  async addEpc(req, res) {
    console.log("Attempting to add a new EPC");

    // Nhận dữ liệu từ request body
    const { epc, barcode, warehouse, timestamp } = req.body;

    // Kiểm tra liệu các trường cần thiết có trống không
    if (!epc || !barcode || !warehouse) {
      return res.status(400).json({
        message: "All fields (epc, barcode, warehouse) are required",
      });
    }

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Kiểm tra xem barcode có tồn tại trong bảng TableBarcode không
      const barcodeExist = await sql.query(
        `SELECT * FROM TableBarcode WHERE barcode = '${barcode}'`
      );

      if (barcodeExist.recordset.length === 0) {
        return res.status(400).json({ message: "Barcode does not exist" });
      }

      // Thêm mới EPC vào cơ sở dữ liệu
      const result = await sql.query(
        `INSERT INTO TableEPC (epc, barcode, warehouse) VALUES ('${epc}', '${barcode}', '${warehouse}')`
      );

      await sql.query`INSERT INTO TableRecord (epc, timestamp, warehouse) VALUES (${epc}, ${timestamp}, ${warehouse})`;

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi phản hồi thành công về cho client
      res.status(201).json({
        message: "EPC added successfully",
        data: { epc, barcode, warehouse },
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to add EPC" });
    }
  }

  async updateEpc(req, res) {
    console.log("Attempting to update EPC");

    // Lấy mã EPC từ tham số đường dẫn
    const epc = req.params.epc;

    // Nhận dữ liệu cập nhật từ request body
    const { barcode, warehouse } = req.body;

    // Kiểm tra liệu các trường cần thiết có trống không
    if (!barcode || !warehouse) {
      return res.status(400).json({
        message: "Barcode and warehouse are required for updating EPC",
      });
    }

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Kiểm tra xem EPC có tồn tại trong bảng TableEPC không
      const epcExist = await sql.query(
        `SELECT * FROM TableEPC WHERE epc = '${epc}'`
      );

      if (epcExist.recordset.length === 0) {
        return res.status(404).json({ message: "EPC not found" });
      }

      // Kiểm tra xem barcode mới có tồn tại trong bảng TableBarcode không
      const barcodeExist = await sql.query(
        `SELECT * FROM TableBarcode WHERE barcode = '${barcode}'`
      );

      if (barcodeExist.recordset.length === 0) {
        return res.status(400).json({ message: "Barcode does not exist" });
      }

      // Cập nhật EPC trong cơ sở dữ liệu
      const result = await sql.query(
        `UPDATE TableEPC SET barcode = '${barcode}', warehouse = '${warehouse}' WHERE epc = '${epc}'`
      );

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi phản hồi thành công về cho client
      res.status(200).json({
        message: "EPC updated successfully",
        data: { epc, barcode, warehouse },
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to update EPC" });
    }
  }

  async deleteEpc(req, res) {
    console.log("Attempting to delete EPC");

    // Lấy mã EPC từ tham số đường dẫn
    const epc = req.params.epc;

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Kiểm tra xem EPC có tồn tại trong bảng TableEPC không
      const epcExist = await sql.query(
        `SELECT * FROM TableEPC WHERE epc = '${epc}'`
      );

      if (epcExist.recordset.length === 0) {
        return res.status(404).json({ message: "EPC not found" });
      }

      // Xóa EPC khỏi cơ sở dữ liệu
      const result = await sql.query(
        `DELETE FROM TableEPC WHERE epc = '${epc}'`
      );

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi phản hồi thành công về cho client
      res.status(200).json({
        message: "EPC deleted successfully",
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to delete EPC" });
    }
  }

  async getEpc(req, res) {
    console.log("Attempting to retrieve EPC details");

    // Lấy mã EPC từ tham số đường dẫn
    const epc = req.params.epc;

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Truy vấn thông tin EPC từ cơ sở dữ liệu
      const result = await sql.query(
        `SELECT * FROM TableEPC WHERE epc = '${epc}'`
      );

      // Kiểm tra xem có kết quả trả về hay không
      if (result.recordset.length === 0) {
        return res.status(404).json({ message: "EPC not found" });
      }

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi thông tin EPC về cho client
      res.status(200).json({
        message: "EPC retrieved successfully",
        data: result.recordset[0], // Trả về thông tin chi tiết của EPC
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to retrieve EPC" });
    }
  }

  async fetchAllEpc(req, res) {
    console.log("Attempting to retrieve all EPC records");

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Truy vấn tất cả thông tin EPC từ cơ sở dữ liệu
      const result = await sql.query(`SELECT * FROM TableEPC`);

      // Kiểm tra xem có kết quả trả về hay không
      if (result.recordset.length === 0) {
        return res.status(404).json({ message: "No EPC records found" });
      }

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi thông tin EPC về cho client
      res.status(200).json({
        message: "All EPC records retrieved successfully",
        data: result.recordset, // Trả về tất cả thông tin của EPC
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to retrieve EPC records" });
    }
  }

  async getEpcByBarcode(req, res) {
    console.log("Attempting to retrieve EPCs for a specific barcode");

    // Lấy mã barcode từ tham số đường dẫn
    const barcode = req.params.barcode;

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Truy vấn thông tin EPC liên kết với barcode cụ thể từ cơ sở dữ liệu
      const result = await sql.query(
        `SELECT * FROM TableEPC WHERE barcode = ${barcode}`
      );

      // Kiểm tra xem có kết quả trả về hay không
      if (result.recordset.length === 0) {
        return res
          .status(404)
          .json({ message: "No EPC records found for this barcode" });
      }

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi thông tin EPC về cho client
      res.status(200).json({
        message: "EPC records retrieved successfully for the specified barcode",
        data: result.recordset, // Trả về thông tin chi tiết của các EPC liên kết với barcode
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to retrieve EPC records" });
    }
  }

  async getEpcByWarehouse(req, res) {
    console.log("Attempting to retrieve EPCs for a specific warehouse");

    // Lấy tên kho từ tham số đường dẫn
    const warehouse = req.params.warehouse;

    console.log(warehouse);

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      console.log(`SELECT * FROM TableEPC WHERE warehouse = ${warehouse}`);

      // Truy vấn thông tin EPC liên kết với kho cụ thể từ cơ sở dữ liệu
      const result = await sql.query(
        `SELECT * FROM TableEPC WHERE warehouse = '${warehouse}'`
      );

      // Kiểm tra xem có kết quả trả về hay không
      if (result.recordset.length === 0) {
        return res
          .status(404)
          .json({ message: "No EPC records found for this warehouse" });
      }

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi thông tin EPC về cho client
      res.status(200).json({
        message:
          "EPC records retrieved successfully for the specified warehouse",
        data: result.recordset, // Trả về thông tin chi tiết của các EPC liên kết với kho
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to retrieve EPC records" });
    }
  }

  async searchEpc(req, res) {
    console.log("Searching EPC records");

    // Nhận các tham số tìm kiếm từ query string
    const { barcode, warehouse } = req.query;

    // Xây dựng câu truy vấn SQL cơ bản
    let query = "SELECT * FROM TableEPC WHERE 1=1";

    // Thêm điều kiện barcode vào câu truy vấn nếu có
    if (barcode) {
      query += ` AND barcode = @barcode`;
    }

    // Thêm điều kiện warehouse vào câu truy vấn nếu có
    if (warehouse) {
      query += ` AND warehouse = @warehouse`;
    }

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Chuẩn bị câu truy vấn SQL
      let request = sql.request();

      // Thêm các tham số vào câu truy vấn nếu chúng tồn tại
      if (barcode) {
        request.input("barcode", sql.VarChar, barcode);
      }
      if (warehouse) {
        request.input("warehouse", sql.VarChar, warehouse);
      }

      // Thực hiện câu truy vấn
      const result = await request.query(query);

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Kiểm tra kết quả trả về
      if (result.recordset.length === 0) {
        return res
          .status(404)
          .json({ message: "No EPC records found matching the criteria" });
      }

      // Gửi thông tin EPC về cho client
      res.status(200).json({
        message: "EPC records retrieved successfully",
        data: result.recordset,
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to search EPC records" });
    }
  }

  async readEpc(req, res) {
    const { epc, timestamp, warehouse } = req.body;

    console.log("Data nhận được: ", req.body);

    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Chuẩn bị câu truy vấn SQL
      // Fetch the current warehouse state
      let result =
        await sql.query`SELECT warehouse FROM TableEPC WHERE epc = ${epc}`;
      if (result.recordset.length === 0) {
        return res.status(404).send("EPC not found");
      }

      result = await sql.query`SELECT barcode FROM TableEPC WHERE epc = ${epc}`;
      const barcord = result.recordset;

      console.log("Barcord: ", barcord);

      // Update the warehouse in TableEPC
      await sql.query`UPDATE TableEPC SET warehouse = ${warehouse}, timestamp = ${timestamp} WHERE epc = ${epc};`;

      result = await sql.query`SELECT
          E.epc,
          B.information,
          E.timestamp,
          C.name AS classification_name,
          E.warehouse
      FROM
          TableEPC E
      JOIN
          TableBarcode B ON E.barcode = B.barcode
      JOIN
          Classification C ON B.classification_id = C.id;
      `;

      // const arrayData = processData(result.recordset);

      // const finalResult = { barcord, action, data: arrayData };

      // console.log(finalResult);

      const finalResult = {
        epc: epc,
        warehouse: warehouse,
        data: result.recordset,
      };

      broadcastData(finalResult);

      await sql.query`INSERT INTO TableRecord (epc, timestamp, warehouse) VALUES (${epc}, ${timestamp}, ${warehouse})`;

      // // Insert the record into TableRecord
      // await sql.query`INSERT INTO TableRecord (epc, timestamp, warehouse) VALUES (${epc}, ${timestamp}, ${newWarehouse})`;

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // broadcastData(finalResult);

      res.status(200).json({
        message:
          "EPC records retrieved successfully for the specified warehouse",
        // Trả về thông tin chi tiết của các EPC liên kết với kho
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to search EPC records" });
    }
  }

  async getRecord(req, res) {
    try {
      const epc = req.params.epc;

      console.log("Epc la : ", epc);
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Truy vấn tất cả thông tin EPC từ cơ sở dữ liệu
      const result = await sql.query(
        `SELECT * FROM TableRecord where epc='${epc}'`
      );

      // Kiểm tra xem có kết quả trả về hay không
      if (result.recordset.length === 0) {
        return res.status(404).json({ message: "No Record records found" });
      }

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi thông tin EPC về cho client
      res.json(result.recordset);
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to retrieve Record records" });
    }
  }

  async getAllRecord(req, res) {
    try {
      // Kết nối với cơ sở dữ liệu
      await sql.connect(dbConfig);

      // Truy vấn tất cả thông tin EPC từ cơ sở dữ liệu
      const result = await sql.query(`SELECT * FROM TableRecord`);

      // Kiểm tra xem có kết quả trả về hay không
      if (result.recordset.length === 0) {
        return res.status(404).json({ message: "No Record records found" });
      }

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // Gửi thông tin EPC về cho client
      res.status(200).json({
        message: "All Record records retrieved successfully",
        data: result.recordset, // Trả về tất cả thông tin của EPC
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to retrieve Record records" });
    }
  }

  async setWarehouse(req, res) {
    try {
      await sql.connect(dbConfig);

      const warehouse = req.params.warehouse;
      await sql.query`UPDATE TableEPC SET warehouse = ${warehouse}`;

      let result = await sql.query`SELECT
          E.epc,
          B.information,
          E.timestamp,
          C.name AS classification_name,
          E.warehouse
      FROM
          TableEPC E
      JOIN
          TableBarcode B ON E.barcode = B.barcode
      JOIN
          Classification C ON B.classification_id = C.id;
      `;

      // const arrayData = processData(result.recordset);

      // const finalResult = { barcord, action, data: arrayData };

      // console.log(finalResult);

      broadcastData(result.recordset);

      // await sql.query`INSERT INTO TableRecord (epc, timestamp, warehouse) VALUES (${epc}, ${timestamp}, ${warehouse})`;

      // // Insert the record into TableRecord
      // await sql.query`INSERT INTO TableRecord (epc, timestamp, warehouse) VALUES (${epc}, ${timestamp}, ${newWarehouse})`;

      // Đóng kết nối cơ sở dữ liệu
      sql.close();

      // broadcastData(finalResult);

      res.status(200).json({
        message:
          "EPC records retrieved successfully for the specified warehouse",
        // Trả về thông tin chi tiết của các EPC liên kết với kho
      });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ message: "Failed to search EPC records" });
    }
  }

  async sendMessageMqtt(req, res) {
    // Nhận topic và message từ request body
    const { topic, message } = req.body;

    console.log(req.body);

    if (!topic || !message) {
      return res.status(400).send("Topic and message are required");
    }

    try {
      // Tạo kết nối MQTT
      const client = mqtt.connect("mqtt://192.168.1.23");

      // Xử lý sự kiện khi kết nối thành công
      client.on("connect", () => {
        console.log("Connected to MQTT broker");

        // Gửi thông điệp đến topic chỉ định
        client.publish(topic, message, {}, (error) => {
          if (error) {
            console.error("Failed to send message:", error);
            client.end();
            return res.status(500).send("Failed to send message");
          }

          console.log("Message sent successfully");
          client.end();
          return res.send("Message sent successfully");
        });
      });

      // Xử lý sự kiện khi có lỗi kết nối
      client.on("error", (error) => {
        console.error("Connection to MQTT broker failed:", error);
        client.end();
        return res.status(500).send("Connection to MQTT broker failed");
      });
    } catch (error) {
      console.error("Error sending message:", error);
      return res.status(500).send("Error processing request");
    }
  }

  constructor() {
    this.clients = []; // Khởi tạo danh sách clients là một mảng rỗng
  }

  // Setter để nhận danh sách clients từ `index.js`
  setClients(clients) {
    this.clients = clients;
  }

  async readTag(req, res) {
    const { epc } = req.body;

    if (!epc) {
      return res.status(400).json({ message: "EPC is required" });
    }

    console.log("Received EPC:", epc);

    // Kiểm tra xem `clients` đã được truyền hay chưa
    if (!this.clients || this.clients.length === 0) {
      return res
        .status(500)
        .json({ message: "No clients available to send data" });
    }

    // Gửi EPC tới tất cả các client qua SockJS
    this.clients.forEach((client) => {
      if (client) {
        client.write(epc); // Gửi dữ liệu EPC tới các client
      }
    });

    return res.json({ message: "EPC sent to clients", epc });
  }
}

module.exports = new Database();
