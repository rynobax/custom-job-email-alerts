const indeed = require('indeed-scraper');
const fs = require('fs');
const request = require('request');
const nodemailer = require('nodemailer');
const ini = require('ini');
const emailConfig = ini.parse(fs.readFileSync('./config/email.ini', 'utf-8'))

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
  {key: 'nodejs', value: 3},
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
  const age = 3;
  cities.push(queryPromise('Software', 'Atlanta, GA',         25, 'entry_level', age));
  cities.push(queryPromise('Software', 'Raleigh-Durham, NC',  25, 'entry_level', age));
  cities.push(queryPromise('Software', 'Charlotte, NC',       25, 'entry_level', age));
  cities.push(queryPromise('Software', 'Clemson, SC',         50, 'entry_level', age));
  cities.push(queryPromise('Software', 'Charleston, SC',      25, 'entry_level', age));
  cities.push(queryPromise('Javascript Developer', 'Greenville, SC', 250, 'entry_level', age));
  return Promise.all(cities);
}

function queryPromise(query, city, radius, level, maxAge){
  return new Promise((resolve, reject) => {
    indeed.query({query: query, city: city, radius: radius, level: level, maxAge: maxAge})
      .then(res => resolve(res))
      .catch(err => {
        console.log('Error for ' + city + ': ' + err);
        resolve([]);
      });
  });
}

function createHtmlPage(cities){
  return new Promise((resolve, reject) => {
    const fileName = 'jobs.html';
    sortJobs(cities, keywords)
      .then(jobs => {
      const fd = fs.openSync(fileName, 'w');
      const d = new Date();
      const todayString = (d.getMonth()+1) + '-' + d.getDate();
      fs.appendFileSync(fd, '<!DOCTYPE html> <html><header><h1>Jobs for ' + todayString + '</h1></header><body>');
      jobs.forEach(e => {
        if(e.score > 0){
          generateJobHtml(e, fd);
        }
      });
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
        jobs[i].id = jobInfo.title.toLowerCase() + jobs[i].summary.toLowerCase();
      });
      const idMap = jobs.map(e => e.id);
      const result = jobs
        .filter((e, i) => idMap.indexOf(e.id) == i)
        .filter(e => e.score > -1)
        .sort((a, b) => b.score - a.score);
      resolve(result);
    });
  });
}

function getKeyScore(jobInfo, keywords){
  const jobInfoLC = {
    title: jobInfo.title.toLowerCase(),
    body: jobInfo.body.toLowerCase()
  };
  return keywords.reduce((s, e) => {
    let v = 0;
    if(jobInfoLC.title.includes(e.key)){
      v += e.value * 3;
      //console.log('Found ' + e.key + ' in title ' + e.value * 3);
    }
    if(jobInfoLC.body.includes(e.key)){
      v += e.value;
      //console.log('Found ' + e.key + ' in body ' + e.value);
    }
    return s + v;
  }, 0);
}

function getJobInfo(job){
  return new Promise((resolve, reject) => {
    request({url: job.url, timeout: 1500}, (error, response, body) => {
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
  html += '<h4>' + job.company + ' (' + job.location + ') '+ '</h4><i>' + job.postDate + '</i>';
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

  console.log('Attempting to send email from ' + from + ' to ' + to);

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
