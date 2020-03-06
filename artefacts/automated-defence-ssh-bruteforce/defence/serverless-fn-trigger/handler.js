var config = require('./config.js')
const AWS = require('aws-sdk')
var axios = require('axios')
var cloudwatchlogs = new AWS.CloudWatchLogs({region:config.region})

module.exports.vpchandler = function (){
    var params = {
        startTime: Date.now() - config.startTimeOffset*60*1000,
        endTime: Date.now(),
        logGroupName: config.logGroup,
        filterPattern: '[Mon, day, timestamp, ip, id, status="Invalid", user, username, from, srcip, ...]'
      };
      
      cloudwatchlogs.filterLogEvents(params, function(err, data) {
        if (err) console.log(err, err.stack);
        else {
          var adict = {}
          ip_pattern = /\w\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\w/
          data.events.forEach(function(item){
              console.log(item.message)
              var ip = item.message.match(ip_pattern)[0]
              if(adict[ip]){
                adict[ip].count = adict[ip].count +1
                adict[ip].events.push(item.message)
              }else{
                adict[ip] = {count:1, events:[item.message]}
              }
          })
          for (var ip in adict){
            var message = 'Detected IP: *' + ip + '* making *'+ adict[ip].count + '* unexpected nework requests!\n```\n' + adict[ip].events + '\n```'
            if(adict[ip].count >= config.attackThreshold){
              blockIP(ip)
            }
            console.log(Date.now() + ':  ' + message)
          }
        }
      });
}

function blockIP(ip){
  axios.get(config.blockIPLambdaUrl, {
    params: {
      accessToken: "JqQDdibtm2xPqDmk",
      ip: ip
    }
  })
  .then(function (response) {
    console.log('IP Blocked - '.ip)
  })
  .catch(function (error) {
    console.log('Error blocking IP')
  })
}