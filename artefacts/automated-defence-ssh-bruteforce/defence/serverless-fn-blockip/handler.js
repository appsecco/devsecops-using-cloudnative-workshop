var config = require('./config.js')
var AWS = require('aws-sdk')

// Initialize the api clients that we be using to interact with Amazon AWS API
var ec2 = new AWS.EC2();
var docClient = new AWS.DynamoDB.DocumentClient()

// Reading the values from the config file
var accessToken = config.accessToken
var ruleValidity = config.ruleValidity
var aclId = config.aclId
var stateTableName = config.stateTableName
var historyTableName = config.historyTableName

// To find the lowest positive missing number in an array
var firstMissingPositive = function(nums) {
    var swap = function(i, j) {
        var tmp = nums[i];
        nums[i] = nums[j];
        nums[j] = tmp;
    };

    for (let i = 0; i < nums.length; i++) {
        while (0 < nums[i] && nums[i] - 1 < nums.length
                && nums[i] != i + 1
                && nums[i] != nums[nums[i] - 1]) {
            swap(i, nums[i] - 1);
        }
    }

    for (let i = 0; i < nums.length; i++) {
        if (nums[i] != i + 1) {
            return i + 1;
        }
    }
    return nums.length + 1;
};

// Function to validate IP addresses
function validateIPaddress(ipaddress) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
        return true
    }
    return false
}

// Function to abstract sending response
function sendResponse(res, statusCode, body) {
    const response = {
        statusCode: statusCode,
        body: JSON.stringify(body)
    }
    res(null, response);
}

// Function to add rule to ACL
function addACLRule(ip, ruleNo) {
    var params = {
        CidrBlock: ip + "/32",
        Egress: false,
        NetworkAclId: aclId,
        Protocol: "-1",
        RuleAction: "deny",
        RuleNumber: ruleNo
    };
    ec2.createNetworkAclEntry(params, function (err, data) {
        if (err) console.log(err);
        else console.log('Added ACL rule to block IP: ', ip);
    });
}

// Function to delete an a rule from ACL
function delACLRule(ruleId) {
    var params = {
        Egress: false,
        NetworkAclId: aclId,
        RuleNumber: ruleId
    };
    ec2.deleteNetworkAclEntry(params, function (err, data) {
        if (err) console.log(err);
        else console.log('Delete ACL ruleId: ', ruleId);
    });
}

// Function to add entry into history table for each action
function logHistory(ip, action) {
    var params = {
        Item: {
            ip: ip,
            actiontaken: action,
            tsval: Date.now(),
        },
        TableName: historyTableName
    }
    docClient.put(params, function (err, data) {
        if (err) {
            console.log(err)
        }
    })
}

// Handler function for the blockip endpoint
module.exports.blockip = function (event, context, response) {

    // Check if the request is authorized
    console.log("Access Token - " + accessToken)
    console.log("Request - " + (event.queryStringParameters.accessToken))
    if (accessToken == event.queryStringParameters.accessToken) {
        var ip = event.queryStringParameters.ip
        if (validateIPaddress(ip)) {
            var timestamp = Math.floor(Date.now() / 1000)
            var expirymin = Math.ceil(timestamp / 60) + ruleValidity

            var params = {
                TableName: stateTableName,
                ProjectionExpression: "id,ip",
            }

            // Reading all values from state table and passing it to onScan callback function
            docClient.scan(params, onScan);

            function onScan(err, data) {
                if (err) {
                    console.log(err)
                }

                // Obtaining an array of ip addresses that have been blocked
                ips = data.Items
                iparray = ips.map(function (vals) {
                    return vals.ip
                })
                indexvalofip = iparray.indexOf(ip)

                // If IP address already exists in the ACL
                if (indexvalofip != -1) {
                    var params = {
                        TableName: stateTableName,
                        Key: {
                            "id": ips[indexvalofip].id
                        },
                        UpdateExpression: "set expirymin = :expmin",
                        ExpressionAttributeValues: {
                            ":expmin": expirymin
                        },
                        ReturnValues: "UPDATED_NEW"
                    };

                    docClient.update(params, function (err, data) {
                        if (err) {
                            console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                            sendResponse(response, 500, {"message": "Internal server error"})
                        } else {
                            console.log("Extended block time for IP: ", ip);
                            sendResponse(response, 200, {"message": "extendedblocktime"})
                            logHistory(ip, 'extendedblocktime')
                        }
                    });
                } else {
                    ids = data.Items
                    ids = ids.map(function (vals) {
                        return vals.id
                    })

                    // Finding ruleId to use
                    ec2.describeNetworkAcls({NetworkAclIds:[aclId]}, function(err, data) {
                        if (err) console.log(err, err.stack); // an error occurred
                        else{
                            var idarray = data.NetworkAcls[0].Entries.map(function (val) {
                                return val.RuleNumber
                            })
                            var ruleId = firstMissingPositive(idarray)
                            var params = {
                                Item: {
                                    id: ruleId,
                                    expirymin: expirymin,
                                    ip: ip
                                },
                                TableName: stateTableName
                            }
                            //Adding to ACL
                            console.log('Blocking IP: ' + ip)
                            docClient.put(params, function (err, data) {
                                if (err) {
                                    console.log(err)
                                }
                            })
                            addACLRule(ip, ruleId)
                            logHistory(ip, 'blocked')
                        }
                    });
                    sendResponse(response, 200, {"message": "blocked"})
                }
            }
        } else {
            sendResponse(response, 400, {"message": "badrequest"})
        }
    } else {
        sendResponse(response, 401, {"message": "unauthorized"})
    }
}

// Handler function for the handleexpiry endpoint
module.exports.handleexpiry =  function () {
    var expirymin = Math.floor(Date.now() / 1000 / 60)
    var params = {
        TableName: stateTableName,
        ProjectionExpression: "id,ip",
        IndexName: "expirymin_index",
        KeyConditionExpression: "expirymin = :expmin",
        ExpressionAttributeValues: {
            ":expmin": expirymin
        }
    }

    // Querying 
    docClient.query(params, function (err, data) {
        if (err) {
            console.log(err)
        } else {
            data.Items.forEach(function (item) {
                // AWS ACL Query
                var params = {
                    TableName: stateTableName,
                    Key: {
                        "id": item.id
                    }
                };
                // Deleting from DB
                docClient.delete(params, function (err, data) {
                    if (err) {
                        console.error("Unable to delete item. Error JSON:", JSON.stringify(err, null, 2));
                    } else {
                        // Delete from ACL
                        delACLRule(item.id)
                        logHistory(item.ip, 'unblocked')
                        console.log("Unblocking IP: " + item.ip)
                    }
                });
            })
        }
    })
}

module.exports.actionhistory = function (event, context, response) {

    // Check if the request is authorized
    if(accessToken==event.queryStringParameters.accessToken){
        var params = {
            TableName: historyTableName,
            ProjectionExpression: "tsval,ip,actiontaken",
        }
    
        // Reading all values from state table and passing it to onScan callback function
        docClient.scan(params, onScan)
    
        function onScan(err, data) {
            if (err) {
                console.log(err)
                sendResponse(response,500,{message:"Internal Error"})
            }else{
                var dataItems = data.Items
                sendResponse(response,200,dataItems)
            }
        }
    }else{
        sendResponse(response, 401, {"message": "unauthorized"})
    }
}