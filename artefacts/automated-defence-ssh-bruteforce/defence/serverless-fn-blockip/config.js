module.exports = {
    region: "<AWS_REGION>",
    accessToken: "<SOME_RANDOM_STRING>",
    aclId: "<VPC_ACL_ID>",
    stateTableName: "ip_block_state",
    historyTableName: "ip_block_history",
    ruleValidity: 10
}

// Used by serverless.yml to dermine deployment region
module.exports.getRegion = function (){
    return module.exports.region
}
