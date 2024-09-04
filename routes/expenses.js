const express = require("express");
const { protect } = require("../middleware/protect");
const { Expenses } = require("../config/models");
const router = express.Router();


router.route("/add").post(protect, async (req, res) => {
    
    const { cost, category, description, date } = req.body;
    
    const expense = new Expenses({ user: req.user._id, cost, category, description, date });
    
    const saved = await expense.save();

    saved.user = null;

    res.status(201).json(saved);

})

router.route("/").get(protect, async (req, res) => {
    const exp = await Expenses.find({ user: req.user._id ,isActive : true}).sort({ date: -1,createdAt:-1 }).select("-createdAt").select("-updatedAt").select("-user");
    
    return res.status(200).json(exp);
})

router.route("/remove/:id").delete(protect, async (req, res) => {
    const exp = await Expenses.findById(req.params.id);
    if (exp.user.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error("You cannot edit other notes");
    }
    if (exp) {
        exp.isActive = false;
        await exp.save();
    } else {
        throw new Error({message:"No expense Found"})
    }
   
    res.status(200).json({message:"Deleted!"})
})


module.exports = router;