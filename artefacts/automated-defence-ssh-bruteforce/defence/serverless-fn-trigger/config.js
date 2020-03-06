module.exports = {
	region: "ap-south-1",										// AWS Region to deploy in
    logGroup: "ssh_logs",                              // CloudWatch Log Group to monitor
    blockIPLambdaUrl: "https://0lpsm5ywug.execute-api.ap-south-1.amazonaws.com/dev/blockip",
    attackThreshold: 3,
    startTimeOffset: 10,                                        // Time offset from current time after which the requests are considered
}

// Used by serverless.yml

module.exports.getRegion = function (){
    return module.exports.region
}

module.exports.getInterval = function (){
	if(module.exports.interval==1)
		return 'rate(' + module.exports.interval + ' minute)'
    return 'rate(' + module.exports.interval + ' minutes)'
}