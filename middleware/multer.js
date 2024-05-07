const multer = require("multer");
const path = require("path");



const storage = multer.diskStorage({
    destination: './uploads/', // Temporary storage
    fileFilter: (req, file, cb) => {
        let ext = path.extname(file.originalname);
        if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
            cb(new Error("file type not supported"), false);
            return;
        }
        cb(null, true);
    }
});


const upload = multer({ storage: storage })


 

module.exports = { upload }