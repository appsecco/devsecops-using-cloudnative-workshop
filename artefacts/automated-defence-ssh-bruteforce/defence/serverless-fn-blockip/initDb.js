var config = require('./config.js')

var AWS = require("aws-sdk")
AWS.config.update({
  region: config.region
});

var dynamodb = new AWS.DynamoDB();

var stateTableParams = {
   "AttributeDefinitions": [ 
        { 
            "AttributeName": "id",
            "AttributeType": "N"
        },
        { 
            "AttributeName": "ip",
            "AttributeType": "S"
        },
        { 
            "AttributeName": "expirymin",
            "AttributeType": "N"
        }  
   ],
   "GlobalSecondaryIndexes": [ 
      { 
         "IndexName": "ip_index",
         "KeySchema": [ 
            { 
               "AttributeName": "ip",
               "KeyType": "HASH"
            }
         ],
         "Projection": { 
            "ProjectionType": "ALL"
         },
         "ProvisionedThroughput": { 
            "ReadCapacityUnits": 5,
            "WriteCapacityUnits": 5
         }         
      },
      { 
         "IndexName": "expirymin_index",
         "KeySchema": [ 
            { 
               "AttributeName": "expirymin",
               "KeyType": "HASH"
            }
         ],
         "Projection": { 
            "ProjectionType": "ALL"
         },
         "ProvisionedThroughput": { 
            "ReadCapacityUnits": 5,
            "WriteCapacityUnits": 5
         } 
      }
   ],
   "KeySchema": [ 
      { 
         "AttributeName": "id",
         "KeyType": "HASH"
      }
   ],
   "ProvisionedThroughput": { 
      "ReadCapacityUnits": 5,
      "WriteCapacityUnits": 5
   },
   "TableName": config.stateTableName
}

var historyTableParams = {
    "AttributeDefinitions": [
        { 
            "AttributeName": "tsval",
            "AttributeType": "N"
        }      
    ],
    "KeySchema": [ 
       { 
          "AttributeName": "tsval",
          "KeyType": "HASH"
       }
    ],
    "ProvisionedThroughput": { 
       "ReadCapacityUnits": 5,
       "WriteCapacityUnits": 5
    },
    "TableName": config.historyTableName
 }

dynamodb.createTable(stateTableParams, function(err, data) {
    if (err) {
        console.error("Unable to create state table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
        //console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        console.log('state table created')
    }
});

dynamodb.createTable(historyTableParams, function(err, data) {
    if (err) {
        console.error("Unable to create history table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
        //console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        console.log('history table created')
    }
});