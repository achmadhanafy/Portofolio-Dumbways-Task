const {Pool} = require('pg')

//setup connection pool
const dbPool = new Pool({
    database : 'personal-web-practice',
    port: 5432,
    user: 'postgres',
    password: 'didisudi'
})

//export db pool to be use for query
module.exports =  dbPool