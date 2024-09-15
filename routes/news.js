const express = require("express");
const { getTopHeadLines } = require("../functions/newsApi");
const router = express.Router();

router.route("/headlines").get(async (req, res) => {
    let data = await getTopHeadLines("in", "general");
    res.status(200).json(data);
})

module.exports = router;
