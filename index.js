const express = require('express')
const dbPool = require('./connection/db')

const app = express()

//connection
const db = require('./connection/db')

//upload File
const upload = require('./middlewares/uploadFile')

//Use bcrypt
const bcrypt = require('bcryptjs')

//import flash and session
const flash = require('express-flash')
const session = require('express-session')
const MemoryStore = require('memorystore')(session)

//use File system
const fs = require('fs')
const {promisify} = require('util')

const deleteFile = promisify(fs.unlink)

//view directory
app.use('/public',express.static(__dirname +'/public'))
app.use('/uploads',express.static(__dirname +'/uploads'))
app.use(express.urlencoded({extended: false}))
app.use(flash())

//Setup middleware session
app.use(
    session({
        cookie:{
            maxAge: 1000 * 60 * 60 * 2,
            secure: false,
            httpOnly: true
        },
        store: new MemoryStore({
            checkPeriod: 86400000 // prune expired entries every 24h
          }),
        saveUninitialized: true,
        resave: false,
        secret: "secretValue"
    })
)

//template engine hbs
app.set('view engine','hbs')

const projects = [
    {
        projectName : 'Personal Web Page',
        startDate : '1 Januari 2022',
        endDate : '1 Februari 2022',
        duration : '1 Month',
        technoList : [
           " /public/assets/html&css.jpg",
            "/public/assets/javascript.png",
            '/public/assets/express.png',
            '/public/assets/nodejs.png',
            '/public/assets/postgres.png'
        ],
        description : 'Personal website to introducing my self and my background. This web user can contact me to get touch with me using email in the contact form. And this website have post my project i have been create',
        truncateDescription : 'Personal website to introducing my self and my background. This web user can contact me to get touch with me using email in the contact form. And this website have post my project i have been create'
    }
]
const month = [
    'January',
    'February',
    'March',
    'April',
    'Mei',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'Desember'
  ]
//Menampilkan halaman Home
app.get('/', function (req,res){


    let query = ""
    if (req.session.isLogin){
        query = `SELECT tb_projects.id,tb_projects.name,start_date,end_date,description,image,user_id,tb_users.name as user_name,email  FROM tb_projects INNER JOIN tb_users ON tb_users.id = tb_projects.user_id where user_id=${req.session.user.id}`
    } else{
        query = `SELECT tb_projects.id,tb_projects.name,start_date,end_date,description,image,user_id,tb_users.name as user_name,email  FROM tb_projects INNER JOIN tb_users ON tb_users.id = tb_projects.user_id`
    }
    
    db.connect((err,client,done)=>{
        if (err) throw err

        client.query(query,(err,result)=>{

            if (err) throw err

            let data = result.rows
            let getTechno = `SELECT project_id, src FROM tb_project_techno`

            client.query(getTechno,(err,result2)=>{
                
            let dataTechno = result2.rows
            
            data = data.map((project) => {
                let getTechnoList =[];
                for(let i=0; i<dataTechno.length;i++){
                    if (dataTechno[i].project_id == project.id) { 
                        getTechnoList.push(dataTechno[i].src)
                    }
                }
                    return{
                        ...project,
                        start_date: getDate(project.start_date),
                        end_date: getDate(project.end_date),
                        technoList : getTechnoList,
                        duration: setupDuration(project.start_date,project.end_date),
                        isLogin: req.session.isLogin
                    }   
            }
            )
            for(let i=0;i<data.length;i++){
                data[i].description = truncateText(data[i].description, 200)
            }
            done()
            console.log(req.session.isLogin);
            res.render('index', {projectsDB : data, user: req.session.user})
        })
        })
    })

})
//Submit register
app.post('/register',(req,res)=>{
    let {name,email,password} = req.body


    let query2 = `SELECT * FROM tb_users`
    const hashPassword = bcrypt.hashSync(password,10)

    db.connect((err,client,done)=>{
        if (err) throw err
        client.query(query2,(err,result)=>{
        
            if (err) throw err

            let cekEmail = true
            
            for(let i =0; i<result.rows.length;i++){
                if(result.rows[i].email == email) {
                    cekEmail = false
                }
            }

            if (password.length >= 8 && password.match(/\d+/g) != null){
                    if (cekEmail){
                        const query = `INSERT INTO tb_users(name,email,password) VALUES ('${name}','${email}','${hashPassword}')`
                        client.query(query,(err,result)=>{
                            if (err) throw err
                            done()

                            req.flash('success', 'Registration success, please login to your account')
                            res.redirect('/login')
                })
                    } else {
                        req.flash('alertEmail','Email has used, please change to another email')
                        res.redirect('/register')
                    }
            }else {
                req.flash('alertPass','Password must have minimal 8 character and must contain a number')
                res.redirect('/register')
            }
            
        })
        })
        
})

//Submit Login 
app.post('/login',(req,res)=>{
    let {email,password} = req.body

    let query = `SELECT * FROM tb_users where email='${email}'`

    db.connect((err,client,done)=>{
        if (err) throw err

        client.query(query,(err,result)=>{
            if (err) throw err
            done()

            if (result.rowCount == 0){
                req.flash('danger', 'Email doesnt Match')
                res.redirect('/login')
            } else {
                let results = result.rows[0]
                const isMatch = bcrypt.compareSync(password, results.password)

                if (isMatch){
                    req.session.isLogin = true
                    req.session.user = {
                        id : results.id,
                        email: results.email,
                        name: results.name
                    }
                    res.redirect('/')
                }else {
                    req.flash('danger','Password doesnt Match')
                    res.redirect('/login')
                }
            }
        })
    })
})

//Direct to email
app.post('/contact-me', function (req,res){
    let emailReceiver = 'achmadhanafy@gmail.com'
    let name = req.body.name
    let phoneNumber = req.body.phoneNumber
    let subject = req.body.subject
    let message = req.body.message

    res.redirect(`mailto:${emailReceiver}?subject=${subject}&body= Hello my name ${name} . ${message}. Please contact me on ${phoneNumber}`)
})

//Create project
app.post('/project',upload.single('image'),function(req,res){

    const techno = [
        req.body.techno1,
        req.body.techno2,
        req.body.techno3,
        req.body.techno4,
        req.body.techno5,
        req.body.techno6
    ]
    let projectName = req.body.projectName
    let startDate = req.body.startDate
    let endDate = req.body.endDate
    let description = req.body.description

    const query = `INSERT INTO tb_projects (name,start_date,end_date,description,image,user_id) VALUES ('${projectName}','${startDate}','${endDate}','${description}','${req.file.filename}','${req.session.user.id}') returning id`
    
    db.connect((err,client,done)=>{
        if (err) throw err
        client.query(query,(err,result)=>{
            if (err) throw err

            let id = result.rows[0].id
            console.log(id);
            for(let i=0;i<=6;i++){
                if (techno[i]){
                    const query2 =`INSERT INTO tb_project_techno(project_id,src) VALUES (${id},'${techno[i]}')`
                    client.query(query2,(err,result)=>{
                        if (err) throw err
                    })
                }
            }
            
           done() 
        })
        res.redirect('/')
    })


    
})
//Delete project
app.get('/delete-project/:id', function(req,res){

    if(req.session.isLogin){
        let id = req.params.id

    const query = `DELETE FROM tb_projects where id=${id} returning image`
    const query2 = `DELETE FROM tb_project_techno where project_id=${id}`
    db.connect((err,client,done)=>{
        if (err) throw err

        client.query(query,(err,result)=>{
            if (err) throw err

            let lastImage = result.rows[0].image
        
        client.query(query2,(err,result)=>{
            if (err) throw err
        })

        deleteFile(`uploads/${lastImage}`)
        done()
        res.redirect('/')
    })
    })
    } else {
        res.redirect('/login')
    }
    // projects.splice(index,1)
    
})

//Menampilkan halaman contact me
app.get('/contact-me', function (req,res){
    res.render('contact',{user: req.session.user})
})

//Menampilkan form add project
app.get('/project', function (req,res){
    let noindex = true
    if (req.session.isLogin){
        res.render('addProject',{noindex,user: req.session.user})
    } else {
        res.redirect('/login')
    }
    
})

//Menampilkan detail project
app.get('/detail-project/:id', function (req,res){

    let id = req.params.id
    let query = `SELECT * FROM tb_projects where id=${id}`
    db.connect((err,client,done)=>{
        if (err) throw err

        client.query(query,(err,result)=>{

            if (err) throw err

            let data = result.rows
            let getTechno = `SELECT project_id, src FROM tb_project_techno where project_id=${id}`

            client.query(getTechno,(err,result2)=>{
                
            let dataTechno = result2.rows
            
            data = data.map((project) => {
                let getTechnoList =[];
                for(let i=0; i<dataTechno.length;i++){
                        getTechnoList.push(dataTechno[i].src)
                }
                    return{
                        ...project,
                        startDate: getFullTime(project.start_date),
                        endDate: getFullTime(project.end_date),
                        technoList : getTechnoList,
                        duration: setupDuration(project.start_date,project.end_date)
                    }   
            }
            )
            done()
            res.render('detailProject', {projects : data[0],user: req.session.user})
        })
        })
    })

})

//Edit project
app.get('/edit-project/:id', function(req,res){

    if (req.session.isLogin){
        let id = req.params.id
    const query = `SELECT * FROM tb_projects where id=${id}`
    db.connect((err,client,done)=>{
        if (err) throw err
        client.query(query,(err,result)=>{
            if (err) throw err
            let dataProject = result.rows[0]

            let startDate = dataProject.start_date

            startDate = getDate(new Date(startDate))
            let endDate = dataProject.end_date
            endDate = getDate(new Date(endDate))
            
            const query2 = `SELECT project_id,src FROM tb_project_techno where project_id=${dataProject.id}`
            client.query(query2, (err,result2)=>{
                if(err) throw err
                dataTechno = result2.rows

                let technoMongoDb = false
                let react = false
                let nextJs = false
                let express = false
                let postgres = false
                let nodeJs = false

                for(let i=0;i<dataTechno.length;i++){
                    if (dataTechno[i].src == "https://drive.google.com/uc?id=15ByzD2zDx-5DjQhOUzKRWR9rxNXaPA5U"){
                        technoMongoDb = true 
                    }
                    if (dataTechno[i].src == "https://drive.google.com/uc?id=1cAqx3rgP8o9OqdHwphTvUcJ8IkJpg1iE"){
                        react = true 
                    }
                    if (dataTechno[i].src == "https://drive.google.com/uc?id=1x99_Yst-dGPMrsFlZQ3iwTxPOkBnTTaH"){
                        nodeJs = true 
                    }
                    if (dataTechno[i].src == "https://drive.google.com/uc?id=1ex2QS_t6s3AzacA5ll3DCmUU2Enx-KnP"){
                        express = true 
                    }
                    if (dataTechno[i].src == "https://drive.google.com/uc?id=1gsllo4mXnhgwadGbmLBzLBcRKYoWILaP"){
                        nextJs = true 
                    }
                    if (dataTechno[i].src == "https://drive.google.com/uc?id=15eaAtrchRLzqklAe5uzpy6ncH1_ySflg"){
                        postgres = true 
                    }
                }
                done()
                res.render('addProject',{dataProject,startDate,endDate,technoMongoDb,react,nextJs,express,postgres,nodeJs})

            })
        })
    })

    } else {
        res.redirect('/login')
    }
    
   
})



app.post('/edit-project/:id',upload.single('image'), function(req,res){
    const id = req.params.id

    const techno = [
        req.body.techno1,
        req.body.techno2,
        req.body.techno3,
        req.body.techno4,
        req.body.techno5,
        req.body.techno6
    ]
    let projectName = req.body.projectName
    let startDate = req.body.startDate
    let endDate = req.body.endDate
    let description = req.body.description

    const query3 = `SELECT image FROM tb_projects where id=${id}`
    
    
    db.connect((err,client,done)=>{
        if (err) throw err
        client.query(query3,(err,result)=>{
            if (err) throw err
            let lastImage = result.rows[0].image
            let newImage = ""
            if (req.file === undefined){
                newImage = lastImage
                
            } else {
                newImage = req.file.filename
            }
            const query = `UPDATE tb_projects SET name='${projectName}',start_date='${startDate}',end_date='${endDate}',description='${description}',image='${newImage}' where id=${id}`
        client.query(query,(err,result)=>{
            if (err) throw err

            const query2 = `DELETE FROM tb_project_techno where project_id=${id}`
            client.query(query2,(err,result)=>{
                if (err) throw err

                for(let i=0;i<=6;i++){
                    if (techno[i]){
                        const query3 =`INSERT INTO tb_project_techno(project_id,src) VALUES (${id},'${techno[i]}')`
                        client.query(query3,(err,result)=>{
                            if (err) throw err
                        })
                    }
                }
            })
            if (req.file){
                deleteFile(`uploads/${lastImage}`)
            }
        })
        })
        done()
        res.redirect('/')
    })


})

//Halaman login
app.get('/login',(req,res)=>{
    res.render('login')
})

//Halaman register
app.get('/register',(req,res)=>{
    res.render('register')
})

//Logout
app.get('/logout',(req,res)=>{
    req.session.destroy()
    res.redirect('/login')
})

const port = 5000;
app.listen(process.env.PORT || port, ()=> console.log(`App listening at http://localhost:${port}`))

function getFullTime(time){
    const date = time.getDate();
    const dateMonth = month[time.getMonth()] 
    const year = time.getFullYear()

    return `${date} ${dateMonth} ${year}`
}

function getDate(date){
    let thisDate = date.getDate();
    let dateMonth = date.getMonth()
    dateMonth = dateMonth + 1
    const year = date.getFullYear()

    if (dateMonth < 10){
        dateMonth = `0${dateMonth}`
    }
    if (thisDate < 10){
        thisDate = `0${thisDate}`
    }

    return `${year}-${dateMonth}-${thisDate}`
}



const setupDuration = (startDate, endDate) => {
    let firstDate = startDate
    let secondDate = endDate
    const findTheDifferenceBetweenTwoDates = (firstDate, secondDate) => {
    firstDate = new Date(firstDate);
      secondDate = new Date(secondDate);
      
      let timeDifference = Math.abs(secondDate.getTime() - firstDate.getTime());
      
      let millisecondsInADay = (1000 * 3600 * 24);
      
      let differenceOfDays = Math.ceil(timeDifference / millisecondsInADay);

      let differenceofMonth = Math.floor(differenceOfDays/ 30 )

      let modOfDifferenceMonth = differenceOfDays % 30

      if (differenceofMonth >= 1){
          return differenceofMonth + " Month " + modOfDifferenceMonth +" Day "
      } else {
          return differenceOfDays+" Days"
      }
      
      
    }

    let result = findTheDifferenceBetweenTwoDates(firstDate, secondDate)
    return result
}

function truncateText(selector, maxLength) {
        truncated = selector

    if (truncated.length > maxLength) {
        truncated = truncated.substr(0,maxLength) + '...';
    }
    return truncated;
}