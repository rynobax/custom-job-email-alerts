const _ = require('lodash');
const indeed = require('../indeed-scraper/index.js');
const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const emailConfig = require('./emailConfig.js');
require('longjohn');

// Keywords need to be lowercase
const keywords = [
  {key: 'junior', value: 5},
  {key: 'entry', value: 5},
  {key: 'recent graduate', value: 5},
  {key: 'fresh graduate', value: 5},
  {key: 'developer', value: 5},
  {key: 'software engineer', value: 5},
  {key: 'programmer', value: 5},
  {key: 'javascript', value: 3},
  {key: 'node js', value: 3},
  {key: 'node.js', value: 3},
  {key: 'angular', value: 3},
  {key: 'android', value: 3},
  {key: 'sql', value: 1},
  {key: 'java', value: 1},
  {key: 'c++', value: 1},
  {key: 'python', value: 1}
];

/* Get all the jobs for an array of cities */
function getAllJobs(){
  const cities = [];
  cities.push(indeed.query('Software', 'Atlanta, GA', 25, 'entry_level', 2));
  cities.push(indeed.query('Software', 'Raleigh-Durham, NC', 25, 'entry_level', 2));
  cities.push(indeed.query('Software', 'Charlotte, NC', 25, 'entry_level', 2));
  cities.push(indeed.query('Software', 'Clemson, SC', 50, '', 2));
  return Promise.all(cities);
}

function createHtmlPage(cities){
  return new Promise((resolve, reject) => {
    const fileName = 'jobs.html';
    sortJobs(cities, keywords).then(jobs => {
      const fd = fs.openSync(fileName, 'w');
      fs.appendFileSync(fd, '<!DOCTYPE html> <html><header><h1>Jobs for Ryan</h1></header><body>');
      jobs.forEach(e => generateJobHtml(e, fd));
      fs.appendFileSync(fd, '</body></html>');
      fs.closeSync(fd);
      resolve(fileName);
    });
  });
}

function sortJobs(cities, keywords){
  return new Promise((resolve, reject) => {
    const jobs = [].concat.apply([], cities);
    const jobInfoPromises = jobs.map(e => getJobInfo(e));
    Promise.all(jobInfoPromises).then( jobsInfo => {
      jobsInfo.forEach((jobInfo, i, a) => {
        const score = getKeyScore(jobInfo, keywords);
        jobs[i].score = score;
      });
      const sorted = jobs.sort((a, b) => b.score - a.score);
      const filtered = jobs.filter(e => e.score > -1);
      resolve(filtered);
    });
  });
}

function getKeyScore(jobInfo, keywords){
  console.log('\n\nGetting score of ' + jobInfo.title);
  const jobInfoLC = {
    title: jobInfo.title.toLowerCase(), 
    body: jobInfo.body.toLowerCase()
  };
  return keywords.reduce((s, e) => {
    let v = 0;
    if(jobInfoLC.title.includes(e.key)){
      v += e.value * 3;
      console.log('Found ' + e.key + ' in title ' + e.value * 3);
    }
    if(jobInfoLC.body.includes(e.key)){
      v += e.value;
      console.log('Found ' + e.key + ' in body ' + e.value);
    }
    return s + v;
  }, 0);
}

function getJobInfo(job){
  return new Promise((resolve, reject) => {
    request(job.url, (error, response, body) => {
      // If we can load the page add that to the info,
      // otherwise just use the title as the info
      if (!error) {
        resolve({title: job.title, body: body + job.summary});
      }else{
        resolve({title: job.title, body: job.summary});
      }
    });
  });
}

function generateJobHtml(job, fd){
  let html = '';
  html += '<hr>';
  html += '<p>';
  html += '<h3>';
  html += '<a href="' + job.url + '">' + job.title + '</a>';
  html += ' | ' + job.score;
  html += '</h3>';
  html += '<h4>' + job.company + ' (' + job.location + ')' + '</h4>';
  html += '<p>' + job.summary + '</p>';
  html += '</p>';
  fs.appendFileSync(fd, html);
}

function sendEmail(fileName){
  const msg = fs.readFileSync(fileName);

  const from = emailConfig.from;
  const pass = emailConfig.password;
  const to = emailConfig.to;
  const transporter = nodemailer.createTransport('smtps://'+from+':'+pass+'@smtp.gmail.com');
  
  const d = new Date();
  const todayString = (d.getMonth()+1) + '-' + d.getDate();

  const mailOptions = {
    from: from, // sender address
    to: to, // list of receivers
    subject: 'Indeed Jobs for ' + todayString, // Subject line
    html: msg // plaintext body
  };
  transporter.sendMail(mailOptions, function(error, info){
    if(error){
      return console.log(error);
    }
    console.log('Jobs email sent: ' + info.response);
  });
}

/* The entry point */

getAllJobs().then(createHtmlPage).then(sendEmail);