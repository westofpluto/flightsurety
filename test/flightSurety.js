
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  var firstAirline;
  var weiMultiple;  

  before('setup contract', async () => {
    config = await Test.Config(accounts);
    firstAirline=config.firstAirline;
    weiMultiple=config.weiMultiple;
    await config.flightSuretyData.authorizeAppContract(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  it(`Only a registered and funded airline may register a new airline if fewer than 5 airlines registered`, async function () {
    //
    // Right now we have 1 registered and 0 funded airlines. We should not be able to register a new airline
    //
    let secondAirline = accounts[2];
    let reverted = false;

    let numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 1, "Should be 1 registered airline");
    let numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 0, "Should be 0 funded airline");
    try { 
        await config.flightSuretyApp.registerAirline(secondAirline,{from: firstAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,true,'Did not revert when unfunded firstAirline tries to register secondAirline');

    //
    // fund firstAirline with insufficient funds
    //
    let airlineRegFee=5*weiMultiple;
    reverted=false;
    try { 
        await config.flightSuretyApp.fundAirline(firstAirline,{from: firstAirline, value: airlineRegFee});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,true,'Did not revert when insufficiently funding first airline');

    numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 1, "Should be 1 registered airline");
    numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 0, "Should be 0 funded airline");

    //
    // properly fund firstAirline 
    //
    airlineRegFee=10*weiMultiple;
    reverted=false;
    try { 
        await config.flightSuretyApp.fundAirline(firstAirline,{from: firstAirline, value: airlineRegFee});
    } catch(error) {
        console.log(firstAirline);
        console.log(error);
        reverted=true;    
    }
    assert.equal(reverted,false,'Error thrown when properly funding first airline');

    numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 1, "Should be 1 registered airline");
    numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 1, "Should be 1 funded airline");

    //
    // now register second airline
    //
    reverted=false;
    try { 
        await config.flightSuretyApp.registerAirline(secondAirline,{from: firstAirline});
    } catch(error) {
        console.log(error);
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when firstAirline tries to register secondAirline');

    numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 2, "Should be 2 registered airlines");
    numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 1, "Should be 1 funded airline");

    //
    // have unfunded secondAirline try to register thirdAirline
    //
    let thirdAirline = accounts[3];
    reverted = false;
    try { 
        await config.flightSuretyApp.registerAirline(thirdAirline,{from: secondAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,true,'Did not revert when unfunded secondAirline tries to register thirdAirline');

    //
    // properly fund secondAirline 
    //
    airlineRegFee=10*weiMultiple;
    reverted=false;
    try { 
        await config.flightSuretyApp.fundAirline(secondAirline,{from: secondAirline, value: airlineRegFee});
    } catch(error) {
        reverted=true;    
    }
    assert.equal(reverted,false,'Error thrown when properly funding second airline');

    //
    // have funded secondAirline register thirdAirline
    //
    reverted = false;
    try { 
        await config.flightSuretyApp.registerAirline(thirdAirline,{from: secondAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when secondAirline tries to register thirdAirline');

    numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 3, "Should be 3 registered airlines");
    numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 2, "Should be 2 funded airline");

    //
    // have unfunded thirdAirline try to register fourthAirline
    //
    let fourthAirline = accounts[4];
    reverted = false;
    try { 
        await config.flightSuretyApp.registerAirline(fourthAirline, {from: thirdAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,true,'Did not revert when unfunded thirdAirline tries to register fourthAirline');

    //
    // properly fund thirdAirline 
    //
    airlineRegFee=10*weiMultiple;
    reverted=false;
    try { 
        await config.flightSuretyApp.fundAirline(thirdAirline,{from: thirdAirline, value: airlineRegFee});
    } catch(error) {
        reverted=true;    
    }
    assert.equal(reverted,false,'Error thrown when properly funding third airline');

    //
    // have funded thirdAirline register fourthAirline
    //
    reverted = false;
    try { 
        await config.flightSuretyApp.registerAirline(fourthAirline, {from: thirdAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when thirdAirline tries to register fourthAirline');

    numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 4, "Should be 4 registered airlines");
    numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 3, "Should be 3 funded airline");

    //
    // have unfunded fourthAirline try to register fifthAirline
    //
    let fifthAirline = accounts[5];
    reverted = false;
    try { 
        await config.flightSuretyApp.registerAirline(fifthAirline, {from: fourthAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,true,'Did not revert when unfunded fourthAirline tries to register fifthAirline');

    //
    // properly fund fourthAirline 
    //
    airlineRegFee=10*weiMultiple;
    reverted=false;
    try { 
        await config.flightSuretyApp.fundAirline(fourthAirline,{from: fourthAirline, value: airlineRegFee});
    } catch(error) {
        reverted=true;    
    }
    assert.equal(reverted,false,'Error thrown when properly funding fourth airline');

    numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 4, "Should be 4 registered airlines");
    numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 4, "Should be 4 funded airline");

    
  });  

  it(`To register the 5th and subsequent airlines, at least 50% of already registered and funded airlines must agree`, async function () {
    let reverted = false;
    let firstAirline = accounts[1];
    let secondAirline = accounts[2];
    let thirdAirline = accounts[3];
    let fourthAirline = accounts[4];
    let fifthAirline = accounts[5];
    let sixthAirline = accounts[6];

    //
    // have funded firstAirline register fifthAirline
    //
    reverted = false;
    try { 
        await config.flightSuretyApp.registerAirline(fifthAirline, {from: firstAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when firstAirline votes to register fifthAirline');

    let numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 4, "Should be 4 registered airlines");
    let numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 4, "Should be 4 funded airline");
    let numVotes=await config.flightSuretyApp.getNumVotesForAirline.call(fifthAirline)
    assert.equal(numVotes, 1, "Should be 1 vote to register fifth airline");

    //
    // have funded secondAirline register fifthAirline
    //
    reverted = false;
    try { 
        await config.flightSuretyApp.registerAirline(fifthAirline, {from: secondAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when secondAirline votes to register fifthAirline');

    numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 5, "Should be 5 registered airlines");
    numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 4, "Should be 4 funded airline");
    numVotes=await config.flightSuretyApp.getNumVotesForAirline.call(fifthAirline)
    assert.equal(numVotes, 0, "Should be 0 votes now to register fifth airline, since already registered");

    //
    // properly fund fifthAirline 
    //
    let airlineRegFee=10*weiMultiple;
    reverted=false;
    try { 
        await config.flightSuretyApp.fundAirline(fifthAirline,{from: fifthAirline, value: airlineRegFee});
    } catch(error) {
        reverted=true;    
    }
    assert.equal(reverted,false,'Error thrown when properly funding fifth airline');

    numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 5, "Should be 5 registered airlines");
    numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 5, "Should be 5 funded airline");

    //
    // have funded firstAirline register sixthAirline
    //
    reverted = false;
    try { 
        await config.flightSuretyApp.registerAirline(sixthAirline, {from: firstAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when firstAirline votes to register sixthAirline');

    numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 5, "Should be 5 registered airlines");
    numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 5, "Should be 5 funded airline");
    numVotes=await config.flightSuretyApp.getNumVotesForAirline.call(sixthAirline)
    assert.equal(numVotes, 1, "Should be 1 vote to register sixth airline");

    //
    // have funded thirdAirline register sixthAirline
    //
    reverted = false;
    try { 
        await config.flightSuretyApp.registerAirline(sixthAirline, {from: thirdAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when thirdAirline votes to register sixthAirline');

    numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 5, "Should be 5 registered airlines");
    numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 5, "Should be 5 funded airline");
    numVotes=await config.flightSuretyApp.getNumVotesForAirline.call(sixthAirline)
    assert.equal(numVotes, 2, "Should be 2 votes to register sixth airline");

    //
    // have funded fifthAirline register sixthAirline
    //
    reverted = false;
    try { 
        await config.flightSuretyApp.registerAirline(sixthAirline, {from: fifthAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when fifthAirline votes to register sixthAirline');

    numReg=await config.flightSuretyApp.getNumRegisteredAirlines.call()
    assert.equal(numReg, 6, "Should be 6 registered airlines");
    numFund=await config.flightSuretyApp.getNumFundedAirlines.call()
    assert.equal(numFund, 5, "Should be 5 funded airline");
    numVotes=await config.flightSuretyApp.getNumVotesForAirline.call(sixthAirline)
    assert.equal(numVotes, 0, "Should be 0 votes to register sixth airline since now registerd");

  }); 
 
  it(`Airline can register its own flight, but not a flight for another airline `, async function () {
    let reverted = false;
    let departureTime1 = new Date(Date.UTC('2021','10','19','12','00','00')).getTime()/1000;   // want it in seconds
    let departureTime2 = new Date(Date.UTC('2021','10','20','15','30','00')).getTime()/1000;   // want it in seconds
    let firstAirline = accounts[1];
    let secondAirline = accounts[2];
    let flightId1= '1234';     
    let flightId2= '6789';     

    //
    // have funded thirdAirline register sixthAirline
    //
    reverted = false;
    try { 
        await config.flightSuretyApp.registerFlight(firstAirline,flightId1,departureTime1,{from: firstAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when firstAirline registers flight');

    reverted=false;
    let flights;
    let flightKey;
    try { 
        flights=await config.flightSuretyApp.getRegisteredFlights();
        flightKey=flights[0];
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when getting registered flights');

    let info;
    try { 
        info=await config.flightSuretyApp.getRegisteredFlightInfo(flightKey);
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when getting registered flight info');

    console.log("Airline is "+info[0]);
    console.log("flightId is "+info[1]);
    console.log("timestamp is "+info[2]);
    console.log("statusCode is "+info[3]);
    console.log("insurancePayable is "+info[4]);
    console.log("insurancePaid is "+info[5]);

    //
    // show that airline can only register its own flights
    //
    reverted = false;
    try { 
        await config.flightSuretyApp.registerFlight(secondAirline,flightId2,departureTime2, {from: thirdAirline});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,true,'No error thrown when thirdAirline tries to register flight for secondAirline');

  }); 

  it(`Passenger can purchase flight insurance up to 1 ether `, async function () {
    let reverted = false;
    let departureTime1 = new Date(Date.UTC('2021','10','19','12','00','00')).getTime()/1000;   // want it in seconds
    let firstAirline = accounts[1];
    let flightId1= '1234';     

    let tooMuch=100+ 1*weiMultiple;
    let justRight=1*weiMultiple;
    let passenger = accounts[8];

    reverted = false;
    try { 
        await config.flightSuretyApp.buyInsurance(firstAirline, flightId1, departureTime1,{from: passenger, value: tooMuch});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,true,'No error thrown when passenger purchases too much insurance');

    reverted = false;
    try { 
        await config.flightSuretyApp.buyInsurance(firstAirline, flightId1, departureTime1,{from: passenger, value: justRight});
    } catch(error) {
        reverted=true;
    }
    assert.equal(reverted,false,'Error thrown when passenger purchases correct amount of insurance');
  });
 
});
