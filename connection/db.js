const {Pool} = require('pg')

//setup connection pool
const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
})

//export db pool to be use for query
module.exports =  dbPool