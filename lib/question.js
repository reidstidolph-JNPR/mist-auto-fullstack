'use strict'
// module for interactive command line

const readline = require('readline')

const askQuestion = (question) => {

  console.log(question)
  
  const rl = readline.createInterface({
    input: process.stdin
  })
  
  return new Promise((resolve) => {
    rl.prompt()
    rl.on('line', (line) => {
      rl.close()
      resolve(line)
    })
  })
}

module.exports = askQuestion