
var Test = require('../config/testConfig.js');
//var BigNumber = require('bignumber.js');

contract('Oracles', async (accounts) => {

  var config;
  let numOracles;
  let firstOracle;

  // Watch contract events
  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;

  let departureTime1 = new Date(Date.UTC('2021','10','19','12','00','00')).getTime()/1000;   // want it in seconds
  let flightId1= '1234';

  before('setup contract', async () => {
    config = await Test.Config(accounts);


  });


  it('can register oracles', async () => {
    
    numOracles=config.numOracles;
    firstOracle=config.firstOracle;

    // ARRANGE
    let fee = await config.flightSuretyApp.ORACLE_REGISTRATION_FEE.call();

    // ACT
    for(let i=0; i<numOracles; i++) {      
      let k=i+firstOracle;
      await config.flightSuretyApp.registerOracle({ from: accounts[k], value: fee });
      let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[k]});
      console.log(`Oracle Registered: ${i}, ${result[0]}, ${result[1]}, ${result[2]}`);
    }
  });

  it('can request flight status', async () => {
    
    // ARRANGE
    //let flight = 'ND1309'; // Course number
    //let timestamp = Math.floor(Date.now() / 1000);
    let flight = flightId1;
    let timestamp = departureTime1;

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for(let i=0; i<numOracles; i++) {
      let k=i+firstOracle;

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[k]});
      for(let idx=0;idx<3;idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_ON_TIME, { from: accounts[k] });

        }
        catch(e) {
          // Enable this when debugging
           //console.log(e);
           console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
        }

      }
    }


  });


 
});
