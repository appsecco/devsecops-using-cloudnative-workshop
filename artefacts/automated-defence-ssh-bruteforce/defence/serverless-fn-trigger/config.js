module.exports = {
    region: "<AWS_REGION>",
    logGroup: "<LOG_GROUP_NAME>",
    blockIPLambdaUrl: "<BLOCK_IP_ENDPOINT>",
    blockIPLambdaAccessToken: "<BLOCK_IP_ENDPOINT_ACCESS_TOKEN>"
    attackThreshold: 3,
    startTimeOffset: 5,
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
