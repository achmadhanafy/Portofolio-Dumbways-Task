const multer = require('multer')

//setup configuration
const storage = multer.diskStorage({
    destination: function(req,file,cb){
        cb(null,"uploads")
    },
    filename: function(req, file,cb){
        cb(null, Date.now()+"-"+file.originalname.replace(/\s/g,""))
    }
})

//implementation configuration
const upload = multer({
    storage:storage
})

module.exports = upload