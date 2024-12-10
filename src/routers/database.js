var express = require("express");
const router = express.Router();

const db = require("../App/controller/database.js");

// router.get("/fetch-all", db.fetchAll);
router.get("/fetch-all-barcode", db.fetchAllBarcode);
router.get("/get-barcode-by-id/:barcode", db.getBarcodeById);
router.get("/get-all-barcode-by-classify/:classify", db.getBarcodeByClassify);
// router.get("/search-barcode/:keyword", db.searchBarcodeByKeyword);
// router.get(
//   "/statistics/barcode-count-by-classification",
//   db.countBarcodeByClassification
// );
// router.get("/statistics/barcode-count-over-time", db.countBarcodeOverTime);
router.post("/add-barcode", db.addBarcode);
router.patch("/update-barcode", db.updateBarcode);
router.delete("/delete-barcode/:barcode", db.deleteBarcode);

// EPC

router.get("/fetch-data", db.fetchData);
router.post("/add-epc", db.addEpc);
router.patch("/update-epc/:epc", db.updateEpc);
router.delete("/delete-epc/:epc", db.deleteEpc);
router.get("/get-epc-by-id/:epc", db.getEpc);
router.get("/fetch-all-epc", db.fetchAllEpc);
router.get("/get-epc-by-barcode/:barcode", db.getEpcByBarcode);
router.get("/get-epc-by-warehouse/:warehouse", db.getEpcByWarehouse);
router.get("/search-epc", db.searchEpc);

router.post("/read-epc", db.readEpc);
router.get("/fetch-all-record", db.getAllRecord);
router.get("/get-record/:epc", db.getRecord);
router.get("/set-warehouse/:warehouse", db.setWarehouse);

router.post("/send-message-mqtt", db.sendMessageMqtt);

router.post("/rfid/read-tag", db.readTag)

module.exports = router;
